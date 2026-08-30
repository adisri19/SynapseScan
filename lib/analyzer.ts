import crypto from 'crypto';
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
    // Indent-based / structure-based depth calculation for fallback
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
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: CHUNK_EVALUATION_SYSTEM_PROMPT },
            { role: 'user', content: promptText }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const contentStr = data.choices?.[0]?.message?.content;
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
      } else {
        const errText = await response.text();
        console.warn(`[Groq LLM Map Evaluation Warning] HTTP ${response.status}:`, errText);
      }
    } catch (err) {
      console.warn('Groq LLM Map Evaluation error, falling back to deterministic AST heuristic:', err);
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
      outdatedPatternsCount: 0,
      priorityScore: 10,
      reviewStatus: 'passed',
      recommendedAction: 'No action needed',
      chunkEvaluations: []
    };
  }

  // Weighted average across maintainability (40%), complexity (35%), and security (25%)
  const totalMaintainability = chunkEvaluations.reduce((sum, c) => sum + c.maintainabilityScore, 0);
  const totalComplexity = chunkEvaluations.reduce((sum, c) => sum + c.complexityScore, 0);
  const totalSecurity = chunkEvaluations.reduce((sum, c) => sum + c.securityScore, 0);

  const avgM = totalMaintainability / chunkEvaluations.length;
  const avgC = totalComplexity / chunkEvaluations.length;
  const avgS = totalSecurity / chunkEvaluations.length;

  const compositeScore = Math.round((avgM * 0.40) + (avgC * 0.35) + (avgS * 0.25));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (compositeScore >= 85) grade = 'A';
  else if (compositeScore >= 70) grade = 'B';
  else if (compositeScore >= 55) grade = 'C';
  else if (compositeScore >= 40) grade = 'D';
  else grade = 'F';

  let reviewStatus: 'passed' | 'flagged' | 'needs_refactor' = 'passed';
  if (grade === 'F' || grade === 'D') reviewStatus = 'flagged';
  else if (grade === 'C') reviewStatus = 'needs_refactor';

  const priorityScore = Math.round((100 - compositeScore) * 10 + loc * 0.5);

  let recommendedAction = 'No action needed';
  if (grade === 'F') recommendedAction = 'Immediate refactor required — high risk technical debt';
  else if (grade === 'D') recommendedAction = 'Schedule refactor in upcoming sprint';
  else if (grade === 'C') recommendedAction = 'Simplify cognitive complexity and abstract nested logic';
  else if (grade === 'B') recommendedAction = 'Minor cleanups and documentation updates';

  const outdatedPatternsCount = chunkEvaluations.reduce((sum, c) => sum + c.identifiedIssues.length, 0);

  return {
    filePath,
    linesOfCode: loc,
    maxNestingDepth: nestingDepth,
    score: grade,
    numericalScore: compositeScore,
    outdatedPatternsCount,
    priorityScore,
    reviewStatus,
    recommendedAction,
    chunkEvaluations
  };
}

/**
 * REDUCE PHASE (Repository Level): Aggregates all file analysis results into final OverallRepositoryScore
 */
export function reduceFileResultsToRepositoryScore(
  fileResults: FileAnalysisResult[],
  duplicationRate = 0
): ScorecardResult {
  const totalLoc = fileResults.reduce((sum, f) => sum + f.linesOfCode, 0);
  const totalPriorityScore = fileResults.reduce((sum, f) => sum + f.priorityScore, 0);

  const avgNumericalScore = fileResults.length > 0
    ? fileResults.reduce((sum, f) => sum + f.numericalScore, 0) / fileResults.length
    : 90;

  const avgComplexity = fileResults.length > 0
    ? fileResults.reduce((sum, f) => sum + f.maxNestingDepth, 0) / fileResults.length
    : 0;

  let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (avgNumericalScore >= 85) overallGrade = 'A';
  else if (avgNumericalScore >= 70) overallGrade = 'B';
  else if (avgNumericalScore >= 55) overallGrade = 'C';
  else if (avgNumericalScore >= 40) overallGrade = 'D';
  else overallGrade = 'F';

  const estimatedDebtHours = Math.round(totalPriorityScore / 250);

  const securityMetric = Math.min(100, fileResults.filter(f => f.score === 'D' || f.score === 'F').length * 20);
  const maintainabilityMetric = Math.min(100, Math.round((100 - avgNumericalScore) * 1.2));

  const debtCategories: DebtCategories = {
    security: parseFloat(securityMetric.toFixed(2)),
    maintainability: parseFloat(maintainabilityMetric.toFixed(2)),
    duplication: parseFloat(Math.min(100, duplicationRate).toFixed(2)),
    coverage: 0
  };

  const fileMetrics: FileMetric[] = fileResults.map(f => ({
    id: '',
    runId: '',
    filePath: f.filePath,
    linesOfCode: f.linesOfCode,
    maxNestingDepth: f.maxNestingDepth,
    score: f.score,
    outdatedPatternsCount: f.outdatedPatternsCount,
    priorityScore: f.priorityScore,
    reviewStatus: f.reviewStatus,
    recommendedAction: f.recommendedAction
  }));

  fileMetrics.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    overallGrade,
    totalLoc,
    avgComplexity: parseFloat(avgComplexity.toFixed(2)),
    duplicationRate: parseFloat(duplicationRate.toFixed(2)),
    estimatedDebtHours,
    debtCategories,
    files: fileMetrics,
    fileResults
  };
}

export function detectDuplications(files: Array<{ path: string; content: string }>): DuplicationBlock[] {
  const windowSize = 5;
  const hashToOccurrences: Record<string, Array<{ filePath: string; startLine: number }>> = {};

  for (const file of files) {
    const lines = file.content.split('\n');
    const lineMap: number[] = [];
    const normalizedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed !== '') {
        normalizedLines.push(trimmed);
        lineMap.push(i + 1);
      }
    }

    if (normalizedLines.length < windowSize) continue;

    for (let i = 0; i <= normalizedLines.length - windowSize; i++) {
      const window = normalizedLines.slice(i, i + windowSize).join('\n');
      const hash = crypto.createHash('md5').update(window).digest('hex');

      if (!hashToOccurrences[hash]) {
        hashToOccurrences[hash] = [];
      }

      hashToOccurrences[hash].push({
        filePath: file.path,
        startLine: lineMap[i]
      });
    }
  }

  const duplications: DuplicationBlock[] = [];

  for (const [hash, occurrences] of Object.entries(hashToOccurrences)) {
    if (occurrences.length >= 2) {
      duplications.push({
        runId: '',
        blockHash: hash,
        lineCount: windowSize,
        fileOccurrences: occurrences
      });
    }
  }

  return duplications;
}

export function scanOutdatedPatterns(code: string): number {
  let count = 0;
  const varMatches = code.match(/\bvar\s+/g);
  if (varMatches) count += varMatches.length;
  const consoleMatches = code.match(/console\.log\s*\(/g);
  if (consoleMatches) count += consoleMatches.length;
  const callbackReg = /\bcallback\b.*function|function.*\bcallback\b/gi;
  const callbackMatches = code.match(callbackReg);
  if (callbackMatches) count += callbackMatches.length;
  return count;
}

export function scoreCodebase(
  files: Array<{ path: string; loc: number; nestingDepth: number; outdatedCount: number }>,
  duplicationRate: number = 0
): ScorecardResult {
  const dummyResults: FileAnalysisResult[] = files.map(f => {
    const depthPenalty = Math.min(40, f.nestingDepth * 8);
    const outdatedPenalty = Math.min(20, f.outdatedCount * 5);
    const numScore = Math.max(20, 95 - depthPenalty - outdatedPenalty);

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (numScore >= 85) grade = 'A';
    else if (numScore >= 70) grade = 'B';
    else if (numScore >= 55) grade = 'C';
    else if (numScore >= 40) grade = 'D';
    else grade = 'F';

    return {
      filePath: f.path,
      linesOfCode: f.loc,
      maxNestingDepth: f.nestingDepth,
      score: grade,
      numericalScore: numScore,
      outdatedPatternsCount: f.outdatedCount,
      priorityScore: Math.round((100 - numScore) * 10 + f.loc * 0.5),
      reviewStatus: grade === 'F' || grade === 'D' ? 'flagged' : grade === 'C' ? 'needs_refactor' : 'passed',
      recommendedAction: grade === 'F' ? 'Immediate refactor required' : 'Maintain module',
      chunkEvaluations: []
    };
  });

  return reduceFileResultsToRepositoryScore(dummyResults, duplicationRate);
}
