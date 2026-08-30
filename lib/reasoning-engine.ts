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
  private readonly defaultModel = 'llama-3.3-70b-versatile';

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
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText
      };
    }

    try {
      // Official OpenAI SDK instance configured for Groq with 3 automatic retries
      const groqClient = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        maxRetries: 3,
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

      const completion = await groqClient.chat.completions.create({
        model: this.defaultModel,
        messages,
        temperature: 0.2,
        max_tokens: 1200
      });

      const llmOutput = completion.choices[0]?.message?.content || this.generateGroundedFallback(taskType, context);

      return {
        success: true,
        text: llmOutput,
        modelUsed: this.defaultModel,
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText
      };

    } catch (err: any) {
      console.warn('[Groq OpenAI SDK Warning] Groq execution error, falling back to grounded context:', err?.message || err);
      return {
        success: true,
        text: this.generateGroundedFallback(taskType, context),
        modelUsed: 'groq-error-fallback',
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText,
        error: err?.message || 'SDK request error'
      };
    }
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

    const overallGrade = run.overall_score || 'C';
    const topFiles = context.topWorstFiles.map(f => `- **\`${f.file_path}\`**: Grade ${f.score} (LOC: ${f.lines_of_code}, Depth: ${f.max_nesting_depth}, Priority: ${Number(f.priority_score || 0).toFixed(0)})`).join('\n');

    switch (taskType) {
      case 'chat':
        return `### 🔍 Repository Audit Overview
- **Overall Codebase Grade**: Grade **${overallGrade}**
- **Total Lines of Code**: ${run.total_loc?.toLocaleString() || 0}
- **Average Nesting Depth**: ${Number(run.avg_complexity || 0).toFixed(1)}
- **Estimated Remediation Debt**: ${Number(run.estimated_debt_hours || 0).toFixed(0)} Hours

#### ⚠️ High Priority Files Requiring Attention:
${topFiles || '- No critical debt files identified.'}`;

      case 'explain':
        return `This file displays elevated structural complexity with depth factor ${context.targetFileMetric?.max_nesting_depth || 1}. Recommended remediation: Modularize nested control blocks and sub-divide utilities to improve maintainability.`;

      default:
        return `Repository Overall Health: Grade **${overallGrade}**. Total LOC: ${run.total_loc}. Estimated Remediation Effort: ${run.estimated_debt_hours} Hours.`;
    }
  }
}

export const reasoningEngine = new GroqReasoningEngine();
