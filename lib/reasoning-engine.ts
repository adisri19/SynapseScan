import OpenAI from 'openai';
import { buildGroundedContext, formatPromptEvidence, GroundedContext } from './context-builder';

export interface ReasoningOptions {
  runId?: string;
  query: string;
  taskType: 'chat' | 'explain' | 'refactor' | 'report' | 'forecast' | 'sprint';
  targetFilePath?: string;
  retrievalLimit?: number;
  systemPromptOverride?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

export interface ReasoningResult {
  success: boolean;
  text: string;
  modelUsed: string;
  retrievedChunksCount: number;
  groundedEvidence: string;
  error?: string;
}

export function sanitizeApiKey(key?: string): string {
  if (!key) return '';
  return key.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Shared Groq Reasoning Engine Singleton.
 * Uses official OpenAI SDK targeting Groq API with built-in retries & backoff.
 */
export class GroqReasoningEngine {
  private readonly models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192'];

  async executeReasoning(options: ReasoningOptions): Promise<ReasoningResult> {
    const {
      runId,
      query,
      taskType,
      targetFilePath,
      retrievalLimit = 5,
      systemPromptOverride,
      chatHistory
    } = options;

    // 1. Build Grounded Evidence Context
    const context = await buildGroundedContext(runId, query, targetFilePath, retrievalLimit);
    const evidenceText = formatPromptEvidence(context);

    // 2. Select System Prompt according to Task Type
    const systemPrompt = systemPromptOverride || this.getSystemPrompt(taskType);

    // 3. Check for GROQ API KEY in environment
    const apiKey = sanitizeApiKey(process.env.GROQ_API_KEY);

    if (!apiKey) {
      const fallbackText = this.generateGroundedFallback(taskType, context);
      return {
        success: true,
        text: fallbackText,
        modelUsed: 'deterministic-grounded-fallback',
        retrievedChunksCount: (context.relevantChunks || []).length,
        groundedEvidence: evidenceText
      };
    }

    const groqClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 2,
      timeout: 25000
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    if (chatHistory && chatHistory.length > 1) {
      const historyWindow = chatHistory.slice(-6, -1);
      for (const msg of historyWindow) {
        const role = msg.role === 'bot' || msg.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: `${evidenceText}\n\nUSER REQUEST: ${query}` });

    // Try models sequentially
    let lastError: any = null;
    for (const modelName of this.models) {
      try {
        const completion = await groqClient.chat.completions.create({
          model: modelName,
          messages,
          temperature: 0.2,
          max_tokens: 1200
        });

        const llmOutput = completion?.choices?.[0]?.message?.content;
        if (llmOutput) {
          return {
            success: true,
            text: llmOutput,
            modelUsed: modelName,
            retrievedChunksCount: (context.relevantChunks || []).length,
            groundedEvidence: evidenceText
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Groq Model Try Failed] Model '${modelName}' failed:`, err?.message || err);
      }
    }

    console.warn('[Groq OpenAI SDK Warning] All Groq models failed, returning grounded fallback:', lastError?.message || lastError);
    return {
      success: true,
      text: this.generateGroundedFallback(taskType, context),
      modelUsed: 'groq-error-fallback',
      retrievedChunksCount: (context.relevantChunks || []).length,
      groundedEvidence: evidenceText,
      error: lastError?.message || 'SDK request error'
    };
  }

  private getSystemPrompt(taskType: string): string {
    switch (taskType) {
      case 'chat':
        return `You are SynapseScan AI Lead Architect.
Answer the engineer's question precisely using the provided repository grounded context and metrics evidence.
Always cite specific file paths, nesting depths, lines of code, and debt scores when answering.
Format your answer with clear Markdown headings and bullet points.`;
      case 'explain':
        return `You are a Senior Systems Auditor.
Provide a concise, highly technical 2-3 sentence explanation of the identified technical debt in the specified file.
Focus on cognitive complexity, control-flow nesting, maintainability risks, and actionable refactoring advice.`;
      case 'refactor':
        return `You are a Principal Software Engineer.
Generate production-ready, clean, refactored code that resolves the technical debt identified in the target file.
Do not use pseudo-code. Provide the complete refactored implementation in Markdown code blocks.`;
      case 'report':
        return `You are an Executive Technology Consultant.
Synthesize an executive summary report for the repository audit.
Summarize key health metrics, overall grade, critical debt hotspots, and strategic remediation recommendations.`;
      default:
        return `You are an AI Software Architect analyzing repository technical debt. Be concise, grounded, and technical.`;
    }
  }

  private generateGroundedFallback(taskType: string, context: GroundedContext): string {
    const run = context.runDetails;
    if (!run) {
      return `### 🔍 Repository Assessment\nNo active audit run context found. Please run a repository audit to generate technical debt metrics.`;
    }

    const overallGrade = run.overallScore || 'C';
    const topFilesList = context.topFiles || [];
    const topFiles = topFilesList.map(f => `- **\`${f.filePath}\`**: Grade ${f.score} (LOC: ${f.linesOfCode}, Depth: ${f.maxNestingDepth}, Priority: ${Number(f.priorityScore || 0).toFixed(0)})`).join('\n');

    switch (taskType) {
      case 'chat': {
        const queryLower = (context.query || '').toLowerCase();
        const matchedFile = topFilesList.find(f => f.filePath && queryLower.includes(f.filePath.toLowerCase()));

        if (matchedFile) {
          return `### 📄 File Analysis: \`${matchedFile.filePath}\`
- **Grade**: **Grade ${matchedFile.score}** (Priority Score: ${Number(matchedFile.priorityScore || 0).toFixed(0)})
- **Lines of Code**: ${matchedFile.linesOfCode} lines
- **Max Nesting Depth**: ${matchedFile.maxNestingDepth}
- **Outdated Syntax Patterns**: ${matchedFile.outdatedPatternsCount}
- **Recommended Action**: ${matchedFile.recommendedAction}

#### 💡 Architectural Insight:
File \`${matchedFile.filePath}\` received **Grade ${matchedFile.score}** because it has ${matchedFile.linesOfCode} lines of code and a max control-flow nesting depth of ${matchedFile.maxNestingDepth}. ${matchedFile.score === 'A' || matchedFile.score === 'B' ? 'This module has a low technical debt footprint and matches code quality guidelines.' : 'Refactoring complex conditional branches into smaller helper functions is advised.'}`;
        }

        return `### 🔍 Repository Audit Overview
- **Overall Codebase Grade**: Grade **${overallGrade}**
- **Total Lines of Code**: ${run.totalLoc || run.total_loc || 0}
- **Average Nesting Depth**: ${Number(run.avgComplexity || run.avg_complexity || 0).toFixed(1)}
- **Estimated Remediation Debt**: ${Number(run.estimatedDebtHours || run.estimated_debt_hours || 0).toFixed(0)} Hours

#### ⚠️ High Priority Files Requiring Attention:
${topFiles || '- No critical debt files identified.'}`;
      }

      case 'explain': {
        const file = context.targetFileMetric || context.topFiles?.[0];
        if (file) {
          return `File \`${file.filePath}\` is rated **Grade ${file.score}** (${file.linesOfCode} LOC, Max Nesting Depth: ${file.maxNestingDepth}, ${file.outdatedPatternsCount} outdated patterns). Priority Score: ${Number(file.priorityScore || 0).toFixed(0)}. ${file.recommendedAction}`;
        }
        return `File analysis indicates a maintenance footprint matching Grade ${overallGrade} quality guidelines. Review function boundaries and control flows.`;
      }

      default:
        return `Repository Overall Health: Grade **${overallGrade}**. Total LOC: ${run.total_loc}. Estimated Remediation Effort: ${run.estimated_debt_hours} Hours.`;
    }
  }
}

export const reasoningEngine = new GroqReasoningEngine();
