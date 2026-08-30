import { buildGroundedContext, formatPromptEvidence } from './context-builder';

export interface ReasoningOptions {
  runId?: string;
  query: string;
  taskType: 'chat' | 'explain' | 'refactor' | 'report' | 'forecast' | 'sprint';
  targetFilePath?: string;
  retrievalLimit?: number;
  systemPromptOverride?: string;
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
 * Uses Groq API (or grounded fallback if Groq API key is missing) to produce strictly code-grounded explanations.
 */
export class GroqReasoningEngine {
  private readonly defaultModel = 'llama-3.3-70b-versatile';
  private readonly groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

  async executeReasoning(options: ReasoningOptions): Promise<ReasoningResult> {
    const {
      runId,
      query,
      taskType,
      targetFilePath,
      retrievalLimit = 5,
      systemPromptOverride
    } = options;

    // 1. Build Grounded Evidence Context
    const context = await buildGroundedContext(runId, query, targetFilePath, retrievalLimit);
    const evidenceText = formatPromptEvidence(context);

    // 2. Select System Prompt according to Task Type
    const systemPrompt = systemPromptOverride || this.getSystemPrompt(taskType);

    // 3. Check for GROQ API KEY in environment
    const apiKey = sanitizeApiKey(process.env.GROQ_API_KEY);

    if (!apiKey) {
      // Fallback deterministic response when GROQ_API_KEY is not configured
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
      const response = await fetch(this.groqEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${evidenceText}\n\nUSER REQUEST: ${query}` }
          ],
          temperature: 0.2,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Groq AI Engine Warning] API call returned error status ${response.status}:`, errorText);
        return {
          success: true,
          text: this.generateGroundedFallback(taskType, context),
          modelUsed: 'groq-fallback',
          retrievedChunksCount: context.relevantChunks.length,
          groundedEvidence: evidenceText,
          error: `Groq API Error ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();
      const llmOutput = data?.choices?.[0]?.message?.content || this.generateGroundedFallback(taskType, context);

      return {
        success: true,
        text: llmOutput,
        modelUsed: this.defaultModel,
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText
      };

    } catch (err: any) {
      console.error('Error invoking Groq API:', err);
      return {
        success: true,
        text: this.generateGroundedFallback(taskType, context),
        modelUsed: 'groq-error-fallback',
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText,
        error: err.message
      };
    }
  }

  private getSystemPrompt(taskType: string): string {
    const baseRules = `You are SynapseScan AI Lead Architect. You process technical debt audits.
CRITICAL GROUNDING RULES:
1. Base your response STRICTLY on the provided GROUNDED DETERMINISTIC ANALYSIS EVIDENCE and RETRIEVED SOURCE CODE CHUNKS.
2. DO NOT fabricate metrics, grades, or lines of code.
3. Reference exact file paths, line ranges, nesting depth, and symbol names where applicable.
4. Keep facts separate from recommendations.`;

    switch (taskType) {
      case 'explain':
        return `${baseRules}\nProvide a concise 2-sentence architectural explanation of the file quality score, highlighting nesting depth and code smells.`;
      case 'refactor':
        return `${baseRules}\nGenerate clean, refactored TypeScript/JavaScript source code that eliminates nested loops and replaces deprecated var/callbacks. Return refactored code directly.`;
      case 'report':
        return `${baseRules}\nProduce an executive summary report section analyzing technical debt posture, high-priority risk files, and velocity drag.`;
      case 'sprint':
        return `${baseRules}\nGenerate a JSON array of sprint remediation tickets prioritizing files with nesting depth >= 4.`;
      case 'chat':
      default:
        return `${baseRules}\nProvide helpful, grounded answers with Markdown formatting and precise file/line references.`;
    }
  }

  private generateGroundedFallback(taskType: string, context: any): string {
    const { runDetails, topFiles, relevantChunks, query } = context;

    if (!runDetails) {
      return `### SynapseScan AI Copilot (Grounded Pipeline)\n\nProcessed query: *"${query}"*\n\nTo view specific code insights, run a repository audit on the dashboard.`;
    }

    if (taskType === 'explain') {
      const topFile = topFiles[0];
      if (topFile) {
        return `File \`${topFile.filePath}\` received Grade ${topFile.score} due to nesting depth of ${topFile.maxNestingDepth} levels across ${topFile.linesOfCode} LOC. ${topFile.recommendedAction}.`;
      }
      return `Module evaluation indicates Grade ${runDetails.overallScore} health across ${runDetails.totalLoc} total lines of code.`;
    }

    if (taskType === 'refactor') {
      const snippet = relevantChunks[0]?.content || '// No source snippet retrieved';
      return `// SynapseScan AI Refactored Snippet\n// Grounded target: ${relevantChunks[0]?.filePath || 'Target module'}\n\n${snippet.replace(/var\s+/g, 'const ')}`;
    }

    // Default Chat fallback
    let response = `### 📊 Grounded Analysis for **${runDetails.owner}/${runDetails.name}**\n\n` +
      `- **Overall Health Grade**: **${runDetails.overallScore}**\n` +
      `- **Total Codebase Footprint**: ${runDetails.totalLoc.toLocaleString()} LOC\n` +
      `- **Average Structural Complexity**: ${runDetails.avgComplexity} max nesting depth\n` +
      `- **Duplication Rate**: ${runDetails.duplicationRate}%\n` +
      `- **Estimated Debt Hours**: **${runDetails.estimatedDebtHours} hours**\n\n` +
      `#### 🚩 Top Priority Files:\n` +
      topFiles.slice(0, 3).map((f: any, i: number) => 
        `**${i + 1}. \`${f.filePath}\`** (Grade \`${f.score}\`, LOC: ${f.linesOfCode}, Depth: ${f.maxNestingDepth})\n  - *Action*: ${f.recommendedAction}`
      ).join('\n');

    if (relevantChunks.length > 0) {
      response += `\n\n### 🔍 Grounded Source Code Snippets (RAG Retrieved Context):\n` +
        relevantChunks.map((c: any, i: number) => 
          `**${i + 1}. \`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})**\n\`\`\`\n${c.content.slice(0, 250)}${c.content.length > 250 ? '\n...' : ''}\n\`\`\`\n`
        ).join('\n');
    }

    return response;
  }
}

export const reasoningEngine = new GroqReasoningEngine();
