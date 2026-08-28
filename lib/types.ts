export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Repository {
  id: string;
  tenantId: string;
  url: string;
  owner: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngestionSession {
  id: string;
  tenantId: string;
  repositoryId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progressStep: string;
  progressPct: number;
  triggeredBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface DebtCategories {
  security: number;        // percentage
  maintainability: number;
  duplication: number;
  coverage: number;
}

export interface AnalysisRun {
  id: string;
  repositoryId: string;
  overallScore: 'A' | 'B' | 'C' | 'D' | 'F';
  totalLoc: number;
  avgComplexity: number;
  duplicationRate: number;
  debtCategories: DebtCategories;
  estimatedDebtHours: number;   // derived: sum of priorityScore / 500
  createdAt: string;
}

export interface FileMetric {
  id: string;
  runId: string;
  filePath: string;
  linesOfCode: number;
  maxNestingDepth: number;
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  outdatedPatternsCount: number;
  priorityScore: number;
  reviewStatus: 'passed' | 'flagged' | 'needs_refactor';
  recommendedAction: string;
}

export interface DuplicationBlock {
  id?: string;
  runId: string;
  blockHash: string;
  lineCount: number;
  fileOccurrences: Array<{ filePath: string; startLine: number }>;
}

export interface DashboardData {
  run: AnalysisRun;
  repository: Repository;
  files: FileMetric[];
  duplications: DuplicationBlock[];
  historicalRuns: Array<{
    id: string;
    overallScore: 'A' | 'B' | 'C' | 'D' | 'F';
    avgComplexity: number;
    duplicationRate: number;
    createdAt: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  cached?: boolean;
  data?: T;
  error?: string;
}

export interface ReviewFilters {
  status: string;
  severity: string;
  module: string;
  startDate: string;
  endDate: string;
}
