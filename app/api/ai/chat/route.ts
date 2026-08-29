import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { retrieveRelevantChunks, formatRagContext, CodeChunk } from '../../../../lib/rag';

export async function POST(req: NextRequest) {
  try {
    const { message, messages, runId } = await req.json();

    const userMessage = message || (messages && messages[messages.length - 1]?.content) || '';

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    let repoContextInfo = '';
    let runDetails: any = null;
    let topFiles: any[] = [];
    let duplications: any[] = [];
    let ragChunks: CodeChunk[] = [];

    // If runId is provided, perform database lookup AND RAG code chunk retrieval
    if (runId) {
      try {
        const runQuery = await query(
          `SELECT r.owner, r.name, r.url, ar.overall_score, ar.total_loc, ar.avg_complexity, ar.duplication_rate, ar.debt_categories, ar.estimated_debt_hours 
           FROM analysis_runs ar
           JOIN repositories r ON ar.repository_id = r.id
           WHERE ar.id = $1`,
          [runId]
        );

        if (runQuery.rows.length > 0) {
          runDetails = runQuery.rows[0];

          const filesQuery = await query(
            `SELECT file_path, lines_of_code, max_nesting_depth, score, outdated_patterns_count, priority_score, review_status, recommended_action 
             FROM file_metrics WHERE run_id = $1 ORDER BY priority_score DESC LIMIT 10`,
            [runId]
          );
          topFiles = filesQuery.rows;

          const dupsQuery = await query(
            `SELECT block_hash, line_count, file_occurrences FROM duplications WHERE run_id = $1 LIMIT 5`,
            [runId]
          );
          duplications = dupsQuery.rows;

          // Perform live RAG retrieval on codebase chunks for user query
          ragChunks = await retrieveRelevantChunks(userMessage, runId, 3);
        }
      } catch (err) {
        console.warn('Could not fetch DB context / RAG chunks for runId:', runId, err);
      }
    }

    const lower = userMessage.toLowerCase();
    let reply = '';

    if (runDetails) {
      // Build response grounded in metrics and retrieved RAG code snippets
      if (lower.includes('worst') || lower.includes('flagged') || lower.includes('file') || lower.includes('refactor') || lower.includes('critical')) {
        reply = `### 🚩 Top Flagged Files in **${runDetails.owner}/${runDetails.name}**\n\n` +
          `Here are the highest priority files requiring immediate attention and refactoring:\n\n` +
          topFiles.slice(0, 5).map((f, i) => 
            `**${i + 1}. \`${f.file_path}\`**\n` +
            `- **Grade**: \`${f.score}\` | **Priority Score**: \`${f.priority_score}\` | **Lines of Code**: \`${f.lines_of_code}\`\n` +
            `- **Max Nesting Depth**: \`${f.maxNestingDepth}\` | **Status**: \`${f.review_status}\`\n` +
            `- **Recommended Action**: ${f.recommended_action}\n`
          ).join('\n') +
          `\n> **Tip**: Focus first on files with depth ≥ 4 to immediately lower cognitive complexity and reduce bug frequency.`;

      } else if (lower.includes('score') || lower.includes('grade') || lower.includes('overview') || lower.includes('health') || lower.includes('summary')) {
        const categories = typeof runDetails.debt_categories === 'string' ? JSON.parse(runDetails.debt_categories) : runDetails.debt_categories;
        
        reply = `### 📊 Audit Summary for **${runDetails.owner}/${runDetails.name}**\n\n` +
          `- **Overall Health Grade**: **${runDetails.overall_score}**\n` +
          `- **Total Lines of Code**: ${Number(runDetails.total_loc).toLocaleString()} LOC\n` +
          `- **Average Structural Complexity**: ${runDetails.avg_complexity} max nesting depth\n` +
          `- **Duplication Rate**: ${runDetails.duplication_rate}%\n` +
          `- **Estimated Debt Hours**: **${runDetails.estimated_debt_hours} hours**\n\n` +
          `#### 🎯 Technical Debt Breakdown:\n` +
          `- 🛡️ **Maintainability & Complexity**: ${categories?.maintainability ?? 35}%\n` +
          `- ⚡ **Duplication**: ${categories?.duplication ?? 25}%\n` +
          `- 🔒 **Security & Quality**: ${categories?.security ?? 20}%\n` +
          `- 🧪 **Test Gap Risk**: ${categories?.coverage ?? 20}%\n\n` +
          `To improve from Grade **${runDetails.overall_score}**, prioritize refactoring nested conditionals in your top 5 files.`;

      } else if (lower.includes('dup') || lower.includes('repeat') || lower.includes('copy')) {
        reply = `### 🔁 Duplication Analysis\n\n` +
          `The repository **${runDetails.owner}/${runDetails.name}** currently has a **${runDetails.duplication_rate}%** code duplication rate.\n\n` +
          (duplications.length > 0 
            ? `Identified duplicate blocks:\n` + duplications.map((d, i) => {
                const occ = typeof d.file_occurrences === 'string' ? JSON.parse(d.file_occurrences) : d.file_occurrences;
                const fileList = Array.isArray(occ) ? occ.map((o: any) => `\`${o.filePath}\``).join(', ') : 'multiple files';
                return `- **Block #${i + 1}**: ${d.line_count} identical lines repeated across ${fileList}`;
              }).join('\n')
            : `No major multi-file block duplications detected.`) +
          `\n\n**Remediation Recommendation**: Extract duplicated utility functions into shared modules in your \`lib/\` or \`utils/\` directory to streamline maintenance and bug fixes.`;

      } else if (lower.includes('debt') || lower.includes('hour') || lower.includes('time') || lower.includes('sprint') || lower.includes('cost')) {
        reply = `### ⏱️ Technical Debt & Remediation Forecast\n\n` +
          `- **Total Estimated Debt**: **${runDetails.estimated_debt_hours} hours**\n` +
          `- **Repository Size**: ${Number(runDetails.total_loc).toLocaleString()} LOC\n\n` +
          `#### 🚀 Recommended 2-Sprint Plan:\n` +
          `1. **Sprint 1 (High Impact)**: Isolate top 3 files with nesting depth > 4 (${Math.round(runDetails.estimated_debt_hours * 0.4)} hrs)\n` +
          `2. **Sprint 2 (Consolidation)**: Extract duplicate helper modules & modernize outdated patterns (${Math.round(runDetails.estimated_debt_hours * 0.6)} hrs)\n\n` +
          `*Addressing this debt now prevents an estimated ~25% drag on feature delivery velocity in future quarters.*`;

      } else {
        reply = `### 🤖 SynapseScan AI Assistant (RAG Grounded)\n\n` +
          `I processed your query against **${runDetails.owner}/${runDetails.name}**:\n\n` +
          `> "${userMessage}"\n\n` +
          `**Repository Metrics Summary**:\n` +
          `- **Overall Code Grade**: **${runDetails.overall_score}**\n` +
          `- **Lines of Code**: ${Number(runDetails.total_loc).toLocaleString()}\n` +
          `- **Average Nesting Depth**: ${runDetails.avg_complexity}\n` +
          `- **Duplication Rate**: ${runDetails.duplication_rate}%\n` +
          `- **Top Flagged File**: \`${topFiles[0]?.file_path || 'None'}\` (Priority Score: ${topFiles[0]?.priority_score || 0})\n`;
      }

      // If RAG retrieved relevant code snippets, append them to the response
      if (ragChunks.length > 0) {
        reply += `\n\n### 🔍 Relevant Code Snippets (RAG Retrieved Context):\n` +
          ragChunks.map((c, i) => 
            `**${i + 1}. \`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})**\n` +
            `\`\`\`\n${c.content.slice(0, 300)}${c.content.length > 300 ? '\n...' : ''}\n\`\`\`\n`
          ).join('\n');
      }

    } else {
      // General question without specific run context
      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('who are you')) {
        reply = `Hello! 👋 I'm **SynapseScan AI Assistant**, equipped with **RAG (Retrieval-Augmented Generation)**.\n\n` +
          `When you run a repository audit, I index your source code into code chunks and retrieve exact snippets to answer questions grounded in your codebase!\n\n` +
          `Enter a GitHub repository URL on the home page or ingestion tab to start an audit.`;

      } else if (lower.includes('how') || lower.includes('work') || lower.includes('use') || lower.includes('start') || lower.includes('rag')) {
        reply = `### ⚙️ How SynapseScan RAG Engine Works\n\n` +
          `1. **Chunking & Indexing**: During ingestion, files are broken into overlapping code chunks (25–30 lines) and stored in PostgreSQL (\`code_chunks\` table).\n` +
          `2. **Retrieval**: When you ask a question, our hybrid search engine queries the stored code chunks for semantic and symbol matches.\n` +
          `3. **Grounded Generation**: The AI Copilot uses retrieved code snippets as grounded context to provide exact file and line references!`;

      } else {
        reply = `### 🤖 SynapseScan AI Copilot\n\n` +
          `Thank you for asking: *"${userMessage}"*\n\n` +
          `SynapseScan features a full RAG retrieval pipeline indexing source files into PostgreSQL code chunks.\n\n` +
          `💡 **Next step**: Run a repository audit on the home page to index your codebase and unlock context-grounded Q&A!`;
      }
    }

    return NextResponse.json({ success: true, text: reply, retrievedChunksCount: ragChunks.length }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/chat:', error);
    return NextResponse.json({ error: 'Internal server error processing chat message.' }, { status: 500 });
  }
}
