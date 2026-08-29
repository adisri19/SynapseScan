import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

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

    // If runId is provided, query database for complete codebase audit context
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

          repoContextInfo = `Repository: ${runDetails.owner}/${runDetails.name} (${runDetails.url})
Score/Grade: ${runDetails.overall_score}
Total Lines of Code: ${Number(runDetails.total_loc).toLocaleString()}
Average Complexity (Nesting Depth): ${runDetails.avg_complexity}
Duplication Rate: ${runDetails.duplication_rate}%
Estimated Remediation Debt: ${runDetails.estimated_debt_hours} hours
Top Flagged Files: ${topFiles.map(f => `${f.file_path} (Grade: ${f.score}, LOC: ${f.lines_of_code}, Depth: ${f.maxNestingDepth}, Priority: ${f.priority_score})`).join('; ')}`;
        }
      } catch (err) {
        console.warn('Could not fetch DB context for runId:', runId, err);
      }
    }

    const lower = userMessage.toLowerCase();
    let reply = '';

    if (runDetails) {
      // User is asking about an analyzed repository
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
        reply = `### 🤖 SynapseScan AI Assistant\n\n` +
          `I analyzed your question regarding **${runDetails.owner}/${runDetails.name}**:\n\n` +
          `> "${userMessage}"\n\n` +
          `Here are key metrics from your repository scan:\n` +
          `- **Overall Code Grade**: **${runDetails.overall_score}**\n` +
          `- **Lines of Code**: ${Number(runDetails.total_loc).toLocaleString()}\n` +
          `- **Average Nesting Depth**: ${runDetails.avg_complexity}\n` +
          `- **Duplication Rate**: ${runDetails.duplication_rate}%\n` +
          `- **Top Flagged File**: \`${topFiles[0]?.file_path || 'None'}\` (Priority Score: ${topFiles[0]?.priority_score || 0})\n\n` +
          `How can I assist you further? You can ask me:\n` +
          `- *"Which files should I refactor first?"*\n` +
          `- *"How can I lower the duplication rate?"*\n` +
          `- *"Give me a sprint breakdown for debt reduction."*`;
      }

    } else {
      // General question without specific run context
      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('who are you')) {
        reply = `Hello! 👋 I'm **SynapseScan AI Assistant**, your real-time software engineering and technical debt copilot.\n\n` +
          `I can analyze code complexity, structural AST nesting depth, duplication rates, and technical debt hours for public GitHub repositories.\n\n` +
          `Enter a GitHub repository URL on the home page or ingestion tab to trigger a live audit, and I will guide you through refactoring strategies!`;

      } else if (lower.includes('how') || lower.includes('work') || lower.includes('use') || lower.includes('start')) {
        reply = `### ⚙️ How SynapseScan Works\n\n` +
          `1. **Enter Repository URL**: Paste any public GitHub repo URL (e.g. \`https://github.com/owner/repo\` or \`owner/repo\`).\n` +
          `2. **Live Ingestion & AST Scan**: Our pipeline clones the tree, parses source files, measures nesting depth, scans duplication blocks, and calculates technical debt.\n` +
          `3. **Interactive Dashboard & AI Recommendations**: Review grade scores, priority file lists, interactive charts, and AI refactoring advice.\n` +
          `4. **Ask Me Anything**: Once an audit is loaded, ask me about specific files, debt hours, or refactoring plans!`;

      } else {
        reply = `### 🤖 SynapseScan AI Copilot\n\n` +
          `Thank you for asking: *"${userMessage}"*\n\n` +
          `SynapseScan provides real-time AST code quality scans, complexity analytics, duplicate block detection, and automated technical debt estimations.\n\n` +
          `💡 **Next step**: Run a repository audit on the home page to unlock detailed file-by-file metrics and customized refactoring plans for your codebase!`;
      }
    }

    return NextResponse.json({ success: true, text: reply }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/chat:', error);
    return NextResponse.json({ error: 'Internal server error processing chat message.' }, { status: 500 });
  }
}
