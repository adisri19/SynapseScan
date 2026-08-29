import { DashboardData, FileMetric } from './types';

export interface AuditNarratives {
  executiveSummary: string;
  roiAnalysis: string;
  riskForecast: string;
  fileExplanations: Record<string, string>;
  refactoredCode: Record<string, string>;
  sprintPlan: string;
}

function generateFallbackInsight(file: FileMetric): string {
  const moduleName = file.filePath.split('/').pop()?.replace('.ts','').replace('.tsx','').replace('.js','') ?? 'module';
  const issues: string[] = [];

  if (file.maxNestingDepth >= 6) issues.push(`critical nesting depth of ${file.maxNestingDepth}`);
  else if (file.maxNestingDepth >= 4) issues.push(`elevated nesting depth of ${file.maxNestingDepth}`);

  if (file.outdatedPatternsCount > 3) issues.push(`${file.outdatedPatternsCount} legacy patterns`);
  else if (file.outdatedPatternsCount > 0) issues.push(`${file.outdatedPatternsCount} outdated pattern${file.outdatedPatternsCount > 1 ? 's' : ''}`);

  if (file.linesOfCode > 250) issues.push(`large file size (${file.linesOfCode} LOC)`);

  const issueStr = issues.length > 0
    ? issues.join(' and ')
    : `a high priority score of ${Math.round(file.priorityScore)}`;

  return `${moduleName} has ${issueStr}, contributing to a Grade ${file.score} debt rating. ${file.recommendedAction}.`;
}

export async function fetchAllAiNarratives(
  runId: string,
  data: DashboardData
): Promise<AuditNarratives> {
  const getAppUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  };

  const appUrl = getAppUrl();

  // Helper fetcher
  const callApi = async (path: string, body: object) => {
    const res = await fetch(`${appUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text || 'An error occurred on the server.' };
    }
    if (!res.ok) throw new Error(`API error calling ${path}: ${json.error || text}`);
    return json.text || '';
  };

  // Trigger base queries in parallel
  const [execSummary, roi, forecast, plan] = await Promise.all([
    callApi('/api/ai/explain-run', { runId }),
    callApi('/api/ai/roi', { runId }),
    callApi('/api/ai/forecast', { runId }),
    callApi('/api/ai/sprint-plan', { runId })
  ]);

  // Fetch file metrics explanations for top 20 files (for scorecards)
  const fileExplanations: Record<string, string> = {};
  const top20Files = data.files.slice(0, 20);
  const explainPromises = top20Files.map(async (file) => {
    try {
      const text = await callApi('/api/ai/explain', { 
        filePath: file.filePath, 
        runId,
        score: file.score,
        linesOfCode: file.linesOfCode,
        maxNestingDepth: file.maxNestingDepth,
        outdatedPatternsCount: file.outdatedPatternsCount,
        priorityScore: file.priorityScore,
        recommendedAction: file.recommendedAction
      });
      fileExplanations[file.filePath] = text;
    } catch {
      fileExplanations[file.filePath] = generateFallbackInsight(file);
    }
  });

  // Fetch refactored code samples for top 5 worst files
  const refactoredCode: Record<string, string> = {};
  const top5Files = data.files.slice(0, 5);
  const refactorPromises = top5Files.map(async (file) => {
    try {
      const text = await callApi('/api/ai/refactor', { filePath: file.filePath, runId });
      refactoredCode[file.filePath] = text;
    } catch {
      refactoredCode[file.filePath] = `// AI Refactor payload failed\n// Manually isolate nesting bounds in: ${file.filePath}`;
    }
  });

  await Promise.allSettled([...explainPromises, ...refactorPromises]);

  return {
    executiveSummary: execSummary,
    roiAnalysis: roi,
    riskForecast: forecast,
    fileExplanations,
    refactoredCode,
    sprintPlan: plan
  };
}
