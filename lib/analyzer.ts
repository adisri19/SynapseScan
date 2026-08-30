import crypto from 'crypto';
import OpenAI from 'openai';
import { CodeChunk, DuplicationBlock, FileMetric, DebtCategories } from './types';
import { retrieveRelevantChunks, formatRagContext } from './rag';
import { sanitizeApiKey } from './reasoning-engine';

export interface ChunkLLMEvaluation {
  chunkIndex: number;
  filePath: string;
  maintainabilityScore: number; // 1 - 100
  complexityScore: number;       // 1 - 100
  securityScore: number;         // 1 - 100
  maxNestingDepth: number;       // 1 - 10+
  reasoning: string;
  identifiedIssues: string[];
}

export interface FileAnalysisResult {
  filePath: string;
  linesOfCode: number;
  maxNestingDepth: number;
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  numericalScore: number; // 0 - 100
  outdatedPatternsCount: number;
  priorityScore: number;
  reviewStatus: 'passed' | 'flagged' | 'needs_refactor';
  recommendedAction: string;
  chunkEvaluations: ChunkLLMEvaluation[];
}

export interface ScorecardResult {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalLoc: number;
  avgComplexity: number;
  duplicationRate: number;
  estimatedDebtHours: number;
  debtCategories: DebtCategories;
  files: FileMetric[];
  fileResults?: FileAnalysisResult[];
}

/**
 * MAP PHASE SYSTEM PROMPT
 * Structured system prompt instructing the LLM to score maintainability, complexity,
 * and security on a 1-100 scale using retrieved RAG dependency context.
 */
export const CHUNK_EVALUATION_SYSTEM_PROMPT = `
You are an expert static analysis engine and code auditor.
Evaluate the provided source code chunk in light of its dependent code context.

CRITICAL INSTRUCTIONS:
1. Score each metric strictly on a scale from 1 to 100:
   - maintainabilityScore (1 = unmaintainable, 100 = perfectly structured & clean)
   - complexityScore (1 = extremely high cognitive/cyclomatic complexity, 100 = clean & linear)
   - securityScore (1 = severe vulnerabilities present, 100 = highly secure & sanitized)
2. Evaluate maxNestingDepth:
   - maxNestingDepth (integer count of deepest nested block/control-flow layer, e.g. 1 for linear functions, 5+ for deeply nested loops/conditionals)
3. Consider context from dependent/related chunks when analyzing symbols and imports.
4. Output strictly valid JSON matching this schema:
{
  "maintainabilityScore": number,
  "complexityScore": number,
  "securityScore": number,
  "maxNestingDepth": number,
  "reasoning": "Concise architectural explanation (2-3 sentences)",
  "identifiedIssues": ["Issue 1", "Issue 2"]
}
`;

export function shouldEvaluateWithLLM(chunk: CodeChunk): boolean {
  const content = chunk.content.trim();
  const loc = content.split('\n').length;

  if (loc <= 5 && !chunk.symbolName) return false;

  const lines = content.split('\n').map(l => l.trim());
  const isAllImports = lines.every(l => l.startsWith('import ') || l.startsWith('export ') || l === '' || l.startsWith('//') || l.startsWith('/*') || l.startsWith('*'));
  if (isAllImports) return false;

  if ((chunk.filePath.endsWith('.json') || chunk.filePath.endsWith('.yaml') || chunk.filePath.endsWith('.config.js') || chunk.filePath.endsWith('.config.ts')) && loc <= 25) {
    return false;
  }

  return true;
}

/**
 * MAP PHASE: Evaluates an individual code chunk using LLM reasoning + RAG retrieved context
 */
export async function evaluateChunkWithRAG(
  chunk: CodeChunk,
  runId?: string,
  groqApiKey?: string,
  skipLLM?: boolean
): Promise<ChunkLLMEvaluation> {
  const needsLLM = !skipLLM && shouldEvaluateWithLLM(chunk);

  if (!needsLLM) {
    const loc = chunk.content.split('\n').length;
    const indentDepths = chunk.content.split('\n').map(l => Math.floor((l.match(/^\s*/)?.[0].length || 0) / 2));
    const nesting = Math.min(10, Math.max(1, Math.max(...indentDepths, 1)));
    const maintainability = Math.max(30, 95 - loc);
    const complexity = Math.max(20, 90 - nesting * 4);
    const security = chunk.content.includes('eval(') || chunk.content.includes('innerHTML') ? 40 : 88;

    return {
      chunkIndex: chunk.chunkIndex,
      filePath: chunk.filePath,
      maintainabilityScore: maintainability,
      complexityScore: complexity,
      securityScore: security,
      maxNestingDepth: nesting,
      reasoning: `Structural analysis: ${chunk.symbolName || 'Block'} contains ${loc} lines with complexity depth ${nesting}.`,
      identifiedIssues: nesting >= 5 ? ['High nesting depth detected'] : []
    };
  }

  let contextSnippet = 'No additional dependent RAG chunks retrieved.';

  if (runId) {
    try {
      const searchTerms = `${chunk.symbolName || ''} ${chunk.filePath}`.trim();
      const dependentChunks = await retrieveRelevantChunks(searchTerms, runId, 3, chunk.filePath);
      const otherChunks = dependentChunks.filter(c => c.chunkIndex !== chunk.chunkIndex);
      if (otherChunks.length > 0) {
        contextSnippet = formatRagContext(otherChunks);
      }
    } catch (e) {
      console.warn('RAG retrieval fallback for chunk evaluation:', e);
    }
  }

  const promptText = `
[TARGET CHUNK TO EVALUATE]
File: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine})
Symbol: ${chunk.symbolType || 'block'} ${chunk.symbolName || ''}
\`\`\`
${chunk.content}
\`\`\`

[RAG DEPENDENCY CONTEXT]
${contextSnippet}
`;

  const apiKey = sanitizeApiKey(groqApiKey || process.env.GROQ_API_KEY);

  if (apiKey) {
    try {
      const groqClient = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        maxRetries: 3,
        timeout: 25000
      });

      const evalModels = ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'groq/compound-mini'];
      let completion;

      for (const m of evalModels) {
        try {
          completion = await groqClient.chat.completions.create({
            model: m,
            messages: [
              { role: 'system', content: CHUNK_EVALUATION_SYSTEM_PROMPT },
              { role: 'user', content: promptText }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          });
          if (completion) break;
        } catch (e) {
          // try next active model
        }
      }

      const contentStr = completion.choices[0]?.message?.content;
      if (contentStr) {
        const parsed = JSON.parse(contentStr);
        return {
          chunkIndex: chunk.chunkIndex,
          filePath: chunk.filePath,
          maintainabilityScore: Math.min(100, Math.max(1, Number(parsed.maintainabilityScore) || 75)),
          complexityScore: Math.min(100, Math.max(1, Number(parsed.complexityScore) || 75)),
          securityScore: Math.min(100, Math.max(1, Number(parsed.securityScore) || 85)),
          maxNestingDepth: Math.max(1, Number(parsed.maxNestingDepth) || 1),
          reasoning: parsed.reasoning || 'Evaluated via Map-Reduce AI engine.',
          identifiedIssues: Array.isArray(parsed.identifiedIssues) ? parsed.identifiedIssues : []
        };
      }
    } catch (err: any) {
      console.warn('[Groq OpenAI SDK Map Evaluation Warning]:', err?.message || err);
    }
  }

  // Fallback heuristic scoring if Groq API key is omitted or fails
  const loc = chunk.content.split('\n').length;
  const indentDepths = chunk.content.split('\n').map(l => Math.floor((l.match(/^\s*/)?.[0].length || 0) / 2));
  const nesting = Math.min(10, Math.max(1, Math.max(...indentDepths, 1)));
  const maintainability = Math.max(30, 95 - loc);
  const complexity = Math.max(20, 90 - nesting * 4);
  const security = chunk.content.includes('eval(') || chunk.content.includes('innerHTML') ? 40 : 88;

  return {
    chunkIndex: chunk.chunkIndex,
    filePath: chunk.filePath,
    maintainabilityScore: maintainability,
    complexityScore: complexity,
    securityScore: security,
    maxNestingDepth: nesting,
    reasoning: `Grounding analysis: ${chunk.symbolName || 'Block'} contains ${loc} lines with complexity depth ${nesting}.`,
    identifiedIssues: nesting >= 5 ? ['High nesting depth detected'] : []
  };
}

/**
 * REDUCE PHASE: Rolls up chunk-level LLM scores to generate FileGrade and OverallRepositoryScore
 */
export function reduceChunkEvaluationsToFileGrade(
  filePath: string,
  chunkEvaluations: ChunkLLMEvaluation[],
  fileContent: string
): FileAnalysisResult {
  const loc = fileContent.split('\n').length;
  const nestingDepth = chunkEvaluations.length > 0 
    ? Math.max(...chunkEvaluations.map(c => c.maxNestingDepth || 1))
    : 1;

  if (chunkEvaluations.length === 0) {
    return {
      filePath,
      linesOfCode: loc,
      maxNestingDepth: nestingDepth,
      score: 'A',
      numericalScore: 90,
      outdatedPatternsCount: scanOutdatedPatterns(fileContent),
      priorityScore: 10,
      reviewStatus: 'passed',
      recommendedAction: 'Code structure matches quality guidelines.',
      chunkEvaluations: []
    };
  }

  // Calculate weighted mean across all evaluated chunks for this file
  const avgMaintainability = chunkEvaluations.reduce((acc, c) => acc + c.maintainabilityScore, 0) / chunkEvaluations.length;
  const avgComplexity = chunkEvaluations.reduce((acc, c) => acc + c.complexityScore, 0) / chunkEvaluations.length;
  const avgSecurity = chunkEvaluations.reduce((acc, c) => acc + c.securityScore, 0) / chunkEvaluations.length;

  // Composite numerical score calculation
  const compositeScore = Math.round((avgMaintainability * 0.40) + (avgComplexity * 0.35) + (avgSecurity * 0.25));

  let scoreLetter: 'A' | 'B' | 'C' | 'D' | 'F' = 'C';
  let reviewStatus: 'passed' | 'flagged' | 'needs_refactor' = 'flagged';
  let recommendedAction = 'Review module dependencies.';

  if (compositeScore >= 85) {
    scoreLetter = 'A';
    reviewStatus = 'passed';
    recommendedAction = 'Code matches highest quality standards.';
  } else if (compositeScore >= 70) {
    scoreLetter = 'B';
    reviewStatus = 'passed';
    recommendedAction = 'Minor maintainability adjustments recommended.';
  } else if (compositeScore >= 55) {
    scoreLetter = 'C';
    reviewStatus = 'flagged';
    recommendedAction = 'Sub-divide complex blocks and refactor conditionals.';
  } else if (compositeScore >= 40) {
    scoreLetter = 'D';
    reviewStatus = 'needs_refactor';
    recommendedAction = 'High priority refactoring required. High cognitive complexity.';
  } else {
    scoreLetter = 'F';
    reviewStatus = 'needs_refactor';
    recommendedAction = 'Critical risk. Immediate refactoring needed for security or maintenance.';
  }

  const outdatedCount = scanOutdatedPatterns(fileContent);
  const priorityScore = Math.max(0, (100 - compositeScore) * 10 + (loc * 0.5) + (nestingDepth * 5));

  return {
    filePath,
    linesOfCode: loc,
    maxNestingDepth: nestingDepth,
    score: scoreLetter,
    numericalScore: compositeScore,
    outdatedPatternsCount: outdatedCount,
    priorityScore,
    reviewStatus,
    recommendedAction,
    chunkEvaluations
  };
}

export function scanOutdatedPatterns(code: string): number {
  let count = 0;
  const varMatches = code.match(/\bvar\s+/g);
  if (varMatches) count += varMatches.length;

  const logMatches = code.match(/console\.log\(/g);
  if (logMatches) count += logMatches.length;

  const callbackMatches = code.match(/callback\(/g);
  if (callbackMatches) count += callbackMatches.length;

  return count;
}

export function scoreCodebase(
  files: Array<{ path: string; content: string }>,
  fileResults?: FileAnalysisResult[]
): ScorecardResult {
  const fileMetrics: FileMetric[] = [];
  let totalLoc = 0;
  let totalNesting = 0;

  files.forEach(file => {
    const loc = file.content.split('\n').length;
    totalLoc += loc;

    const fileResult = fileResults?.find(r => r.filePath === file.path);
    const nesting = fileResult ? fileResult.maxNestingDepth : 1;
    const score = fileResult ? fileResult.score : 'A';
    const outdatedCount = scanOutdatedPatterns(file.content);
    const priorityScore = fileResult ? fileResult.priorityScore : (loc * (nesting * 3.0) + (outdatedCount * 2.0));
    const recommendedAction = fileResult ? fileResult.recommendedAction : 'Review structure';

    totalNesting += nesting;

    fileMetrics.push({
      filePath: file.path,
      linesOfCode: loc,
      maxNestingDepth: nesting,
      score,
      outdatedPatternsCount: outdatedCount,
      priorityScore,
      reviewStatus: fileResult ? fileResult.reviewStatus : (priorityScore > 200 ? 'needs_refactor' : 'passed'),
      recommendedAction
    });
  });

  const avgComplexity = files.length > 0 ? Number((totalNesting / files.length).toFixed(1)) : 1.0;
  const duplications = detectDuplications(files);
  const totalDuplicatedLines = duplications.reduce((sum, d) => sum + (d.lineCount * d.fileOccurrences.length), 0);
  const duplicationRate = totalLoc > 0 ? Number(((totalDuplicatedLines / totalLoc) * 100).toFixed(1)) : 0.0;

  let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (fileResults && fileResults.length > 0) {
    const avgNumerical = fileResults.reduce((acc, r) => acc + r.numericalScore, 0) / fileResults.length;
    if (avgNumerical >= 85) overallGrade = 'A';
    else if (avgNumerical >= 70) overallGrade = 'B';
    else if (avgNumerical >= 55) overallGrade = 'C';
    else if (avgNumerical >= 40) overallGrade = 'D';
    else overallGrade = 'F';
  } else {
    if (avgComplexity > 8 || duplicationRate > 25) overallGrade = 'F';
    else if (avgComplexity > 6 || duplicationRate > 18) overallGrade = 'D';
    else if (avgComplexity > 4 || duplicationRate > 12) overallGrade = 'C';
    else if (avgComplexity > 2.5 || duplicationRate > 6) overallGrade = 'B';
  }

  const estimatedDebtHours = Math.round((totalLoc * 0.08) + (avgComplexity * 12) + (duplications.length * 4));

  const totalIssueWeight = Math.max(1, fileMetrics.reduce((sum, f) => sum + f.priorityScore, 0));
  const debtCategories: DebtCategories = {
    maintainability: Math.min(100, Math.round((totalLoc / totalIssueWeight) * 40)),
    security: Math.min(100, Math.round((avgComplexity / 10) * 30)),
    duplication: Math.min(100, Math.round(duplicationRate * 2)),
    coverage: 25
  };

  return {
    overallGrade,
    totalLoc,
    avgComplexity,
    duplicationRate,
    estimatedDebtHours,
    debtCategories,
    files: fileMetrics,
    fileResults
  };
}

export function detectDuplications(files: Array<{ path: string; content: string }>): DuplicationBlock[] {
  const windowSize = 5;
  const hashToOccurrences: Record<string, Array<{ filePath: string; startLine: number }>> = {};

  files.forEach(file => {
    const lines = file.content.split('\n');
    if (lines.length < windowSize) return;

    for (let i = 0; i <= lines.length - windowSize; i++) {
      const windowStr = lines.slice(i, i + windowSize).map(l => l.trim()).join('\n');
      if (windowStr.length < 20) continue;

      const hash = crypto.createHash('md5').update(windowStr).digest('hex');
      if (!hashToOccurrences[hash]) {
        hashToOccurrences[hash] = [];
      }
      hashToOccurrences[hash].push({ filePath: file.path, startLine: i + 1 });
    }
  });

  const duplicationBlocks: DuplicationBlock[] = [];
  Object.entries(hashToOccurrences).forEach(([hash, occurrences]) => {
    if (occurrences.length > 1) {
      duplicationBlocks.push({
        blockHash: hash,
        lineCount: windowSize,
        fileOccurrences: occurrences
      });
    }
  });

  return duplicationBlocks.slice(0, 10);
}
