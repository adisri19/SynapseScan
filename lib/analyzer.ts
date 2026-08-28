import crypto from 'crypto';
import { DuplicationBlock, FileMetric, DebtCategories } from './types';

export function calculateNestingDepth(code: string): number {
  const cleanCode = code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  let maxDepth = 0;
  let currentDepth = 0;

  for (let i = 0; i < cleanCode.length; i++) {
    const char = cleanCode[i];
    if (char === '{') {
      currentDepth++;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }
    } else if (char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
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
        runId: '', // populated at DB level
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
  if (varMatches) {
    count += varMatches.length;
  }

  const consoleMatches = code.match(/console\.log\s*\(/g);
  if (consoleMatches) {
    count += consoleMatches.length;
  }

  const callbackReg = /\bcallback\b.*function|function.*\bcallback\b/gi;
  const callbackMatches = code.match(callbackReg);
  if (callbackMatches) {
    count += callbackMatches.length;
  }

  return count;
}

export interface ScorecardResult {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalLoc: number;
  avgComplexity: number;
  duplicationRate: number;
  estimatedDebtHours: number;
  debtCategories: DebtCategories;
  files: FileMetric[];
}

export function scoreCodebase(
  files: Array<{ path: string; loc: number; nestingDepth: number; outdatedCount: number }>,
  duplicationRate: number = 0
): ScorecardResult {
  let totalPriorityScore = 0;

  const fileMetrics: FileMetric[] = files.map(file => {
    const priorityScore = file.loc * (file.nestingDepth * 3.0) + (file.outdatedCount * 2.0);
    totalPriorityScore += priorityScore;
    
    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (priorityScore < 50) grade = 'A';
    else if (priorityScore < 150) grade = 'B';
    else if (priorityScore < 400) grade = 'C';
    else if (priorityScore < 800) grade = 'D';
    else grade = 'F';

    let reviewStatus: 'passed' | 'flagged' | 'needs_refactor' = 'passed';
    if (grade === 'F' || grade === 'D') {
      reviewStatus = 'flagged';
    } else if (grade === 'C') {
      reviewStatus = 'needs_refactor';
    }

    let recommendedAction = 'No action needed';
    if (grade === 'F') {
      recommendedAction = 'Refactor immediately — critical debt';
    } else if (grade === 'D') {
      recommendedAction = 'Schedule refactor within sprint';
    } else if (grade === 'C') {
      recommendedAction = 'Reduce nesting depth and callbacks';
    } else if (grade === 'B') {
      recommendedAction = 'Minor cleanup — low priority';
    }

    return {
      id: '', // populated at DB level
      runId: '', // populated at DB level
      filePath: file.path,
      linesOfCode: file.loc,
      maxNestingDepth: file.nestingDepth,
      score: grade,
      outdatedPatternsCount: file.outdatedCount,
      priorityScore,
      reviewStatus,
      recommendedAction
    };
  });

  fileMetrics.sort((a, b) => b.priorityScore - a.priorityScore);

  const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);
  const avgComplexity = files.length > 0 
    ? files.reduce((sum, f) => sum + f.nestingDepth, 0) / files.length
    : 0;

  let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (avgComplexity < 2) overallGrade = 'A';
  else if (avgComplexity < 4) overallGrade = 'B';
  else if (avgComplexity < 6) overallGrade = 'C';
  else if (avgComplexity < 9) overallGrade = 'D';
  else overallGrade = 'F';

  const estimatedDebtHours = Math.round(totalPriorityScore / 500);

  // Derived Category Breakdowns (percentages 0-100)
  const clampedDuplication = Math.min(100, duplicationRate);
  const maintainability = Math.min(100, avgComplexity * 11);
  const filesWithOutdated = files.filter(f => f.outdatedCount > 2).length;
  const security = files.length > 0 ? (filesWithOutdated / files.length) * 100 : 0;
  const coverage = 0; // fixed placeholder as specified

  const debtCategories: DebtCategories = {
    security: parseFloat(security.toFixed(2)),
    maintainability: parseFloat(maintainability.toFixed(2)),
    duplication: parseFloat(clampedDuplication.toFixed(2)),
    coverage
  };

  return {
    overallGrade,
    totalLoc,
    avgComplexity: parseFloat(avgComplexity.toFixed(2)),
    duplicationRate: parseFloat(duplicationRate.toFixed(2)),
    estimatedDebtHours,
    debtCategories,
    files: fileMetrics
  };
}
