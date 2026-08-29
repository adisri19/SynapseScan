import { DashboardData } from './types';

export interface AuditNarratives {
  executiveSummary: string;
  roiAnalysis: string;
  riskForecast: string;
  fileExplanations: Record<string, string>;
  refactoredCode: Record<string, string>;
  sprintPlan: string;
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
    if (!res.ok) throw new Error(`API error calling ${path}`);
    const json = await res.json();
    return json.text || '';
  };

  // Trigger base queries in parallel
  const [execSummary, roi, forecast, plan] = await Promise.all([
    callApi('/api/ai/explain-run', { runId }),
    callApi('/api/ai/roi', { runId }),
    callApi('/api/ai/forecast', { runId }),
    callApi('/api/ai/sprint-plan', { runId })
  ]);

  // Fetch file metrics explanations for top 10 files
  const fileExplanations: Record<string, string> = {};
  const top10Files = data.files.slice(0, 10);
  const explainPromises = top10Files.map(async (file) => {
    try {
      const text = await callApi('/api/ai/explain', { filePath: file.filePath, runId });
      fileExplanations[file.filePath] = text;
    } catch {
      fileExplanations[file.filePath] = 'Remediation advised to isolate code complexities.';
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
