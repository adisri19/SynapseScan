import { NextRequest, NextResponse } from 'next/server';
import { parseGitHubUrl, fetchRepositoryTree, downloadFileContents } from '../../../lib/github';
import { 
  detectDuplications, 
  evaluateChunkWithRAG, 
  reduceChunkEvaluationsToFileGrade, 
  reduceFileResultsToRepositoryScore,
  FileAnalysisResult
} from '../../../lib/analyzer';
import { query, pool } from '../../../lib/db';
import { DashboardData, CodeChunk } from '../../../lib/types';
import { indexRepositoryChunks } from '../../../lib/rag';
import { chunkCodeFile } from '../../../lib/chunker';

export const maxDuration = 300; // 5 minutes for large repos

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const controller = new AbortController();
  // Dynamic timeout based on repo size — set after filePaths is known
  // For now use 4.5 minutes max (safety buffer under maxDuration)
  const timeoutId = setTimeout(() => controller.abort(), 270000);

  const defaultTenantId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  try {
    const { repoUrl, triggeredBy = 'Enterprise Administrator' } = await req.json();

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required.' }, { status: 400 });
    }

    let normalizedUrl = repoUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      const parts = normalizedUrl.split('/');
      if (parts.length >= 2) {
        normalizedUrl = 'https://github.com/' + normalizedUrl;
      }
    } else if (normalizedUrl.startsWith('http://')) {
      normalizedUrl = 'https://' + normalizedUrl.slice(7);
    }
    
    if (normalizedUrl.startsWith('https://www.github.com/')) {
      normalizedUrl = 'https://github.com/' + normalizedUrl.slice(23);
    }

    if (!normalizedUrl.startsWith('https://github.com/')) {
      return NextResponse.json({ error: 'Repository URL must start with https://github.com/ or be in "owner/repo" format' }, { status: 400 });
    }

    let owner = '';
    let repo = '';
    let branch = '';

    try {
      const parsed = parseGitHubUrl(normalizedUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      branch = parsed.branch;
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Invalid GitHub URL' }, { status: 400 });
    }

    const cleanUrl = `https://github.com/${owner}/${repo}`;

    // 1. Cache Check
    const repoCheck = await query(
      'SELECT id FROM repositories WHERE url = $1',
      [cleanUrl]
    );

    if (repoCheck.rows.length > 0) {
      const repositoryId = repoCheck.rows[0].id;
      const runCheck = await query(
        `SELECT id, overall_score, total_loc, avg_complexity, duplication_rate, debt_categories, estimated_debt_hours 
         FROM analysis_runs 
         WHERE repository_id = $1 AND created_at >= NOW() - INTERVAL '24 hours' 
         ORDER BY created_at DESC LIMIT 1`,
        [repositoryId]
      );

      if (runCheck.rows.length > 0) {
        const run = runCheck.rows[0];
        
        const filesQuery = await query(
          `SELECT file_path, lines_of_code, max_nesting_depth, score, outdated_patterns_count, priority_score, review_status, recommended_action 
           FROM file_metrics WHERE run_id = $1`,
          [run.id]
        );

        const dupsQuery = await query(
          `SELECT block_hash, line_count, file_occurrences 
           FROM duplications WHERE run_id = $1`,
          [run.id]
        );

        // Also fetch historical runs for cached responses
        const historicalQuery = await query(
          `SELECT id, overall_score, avg_complexity, duplication_rate, created_at 
           FROM analysis_runs 
           WHERE repository_id = $1 
           ORDER BY created_at DESC LIMIT 10`,
          [repositoryId]
        );

        const responseData: DashboardData = {
          run: {
            id: run.id,
            repositoryId,
            overallScore: run.overall_score,
            totalLoc: run.total_loc,
            avgComplexity: parseFloat(run.avg_complexity),
            duplicationRate: parseFloat(run.duplication_rate),
            debtCategories: run.debt_categories,
            estimatedDebtHours: run.estimated_debt_hours,
            createdAt: runCheck.rows[0].created_at
          },
          repository: {
            id: repositoryId,
            tenantId: defaultTenantId,
            url: cleanUrl,
            owner,
            name: repo
          },
          files: filesQuery.rows.map(row => ({
            id: row.id,
            runId: run.id,
            filePath: row.file_path,
            linesOfCode: row.lines_of_code,
            maxNestingDepth: row.max_nesting_depth,
            score: row.score,
            outdatedPatternsCount: row.outdated_patterns_count,
            priorityScore: parseFloat(row.priority_score),
            reviewStatus: row.review_status,
            recommendedAction: row.recommended_action
          })),
          duplications: dupsQuery.rows.map(row => ({
            blockHash: row.block_hash,
            lineCount: row.line_count,
            fileOccurrences: row.file_occurrences,
            runId: run.id
          })),
          historicalRuns: historicalQuery.rows.map(h => ({
            id: h.id,
            overallScore: h.overall_score,
            avgComplexity: parseFloat(h.avg_complexity),
            duplicationRate: parseFloat(h.duplication_rate),
            createdAt: h.created_at
          }))
        };

        // Ensure ingestion session exists for logs
        await query(
          `INSERT INTO ingestion_sessions (tenant_id, repository_id, status, progress_step, progress_pct, triggered_by, completed_at)
           VALUES ($1, $2, 'done', 'Finalized', 100, $3, NOW())`,
          [defaultTenantId, repositoryId, triggeredBy]
        );

        clearTimeout(timeoutId);
        return NextResponse.json({ cached: true, success: true, data: responseData }, { status: 200 });
      }
    }

    // 2. Full Ingestion & Analysis (Cache Miss)
    let filePaths: string[] = [];
    try {
      filePaths = await fetchRepositoryTree(owner, repo, branch);
    } catch (e: any) {
      if (e.message?.includes('Not Found') || e.message?.includes('404')) {
        return NextResponse.json({ error: 'GitHub repository not found.' }, { status: 404 });
      }
      throw e;
    }

    // Smart tiered sampling for large repos
    // Small repos (≤100 files): analyze everything
    // Medium repos (101-500 files): analyze up to 150 files with smart prioritization
    // Large repos (501-2000 files): analyze up to 100 files, deeply sampled
    // Industry repos (2000+ files): analyze up to 80 files, most representative

    const totalFileCount = filePaths.length;

    let maxFilesLimit: number;
    if (totalFileCount <= 100) {
      maxFilesLimit = totalFileCount; // analyze all
    } else if (totalFileCount <= 500) {
      maxFilesLimit = 150;
    } else if (totalFileCount <= 2000) {
      maxFilesLimit = 100;
    } else {
      maxFilesLimit = 80;
    }

    if (filePaths.length > maxFilesLimit) {
      // Priority scoring per file path
      const scorePath = (p: string): number => {
        const lower = p.toLowerCase();
        const ext = lower.split('.').pop() || '';
        let score = 0;

        // Extension priority — source code first
        const extScores: Record<string, number> = {
          tsx: 10, ts: 10, jsx: 9, js: 9,
          py: 8, java: 8, go: 8, rs: 8,
          cs: 7, cpp: 7, c: 7, rb: 6,
          php: 5, swift: 5, kt: 5
        };
        score += extScores[ext] ?? 0;

        // High-value path segments
        if (lower.includes('/src/')) score += 5;
        if (lower.includes('/lib/')) score += 4;
        if (lower.includes('/core/')) score += 4;
        if (lower.includes('/api/')) score += 4;
        if (lower.includes('/server/')) score += 3;
        if (lower.includes('/services/')) score += 3;
        if (lower.includes('/controllers/')) score += 3;
        if (lower.includes('/models/')) score += 3;
        if (lower.includes('/utils/')) score += 2;
        if (lower.includes('/helpers/')) score += 2;
        if (lower.includes('/hooks/')) score += 2;
        if (lower.includes('/components/')) score += 2;

        // Deprioritize test files and config
        if (lower.includes('/test/') || lower.includes('/tests/') ||
            lower.includes('.test.') || lower.includes('.spec.') ||
            lower.includes('__tests__')) score -= 3;
        if (lower.includes('.config.') || lower.includes('.setup.')) score -= 2;
        if (lower.includes('/stories/') || lower.includes('.stories.')) score -= 3;
        if (lower.includes('/mock') || lower.includes('/fixture')) score -= 2;
        if (lower.includes('/generated/') || lower.includes('/gen/')) score -= 4;
        if (lower.includes('/vendor/') || lower.includes('/third_party/')) score -= 5;

        // Shorter paths = higher-level files = more important
        const depth = (p.match(/\//g) || []).length;
        score += Math.max(0, 5 - depth);

        return score;
      };

      filePaths = filePaths
        .map(p => ({ path: p, score: scorePath(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxFilesLimit)
        .map(x => x.path);

      console.log(`[Analyze] Large repo detected: ${totalFileCount} files → sampling ${maxFilesLimit} highest-priority files`);
    }

    const downloadedFiles: Array<{ path: string; content: string }> = [];
    // Increase concurrency for larger file sets
    const limit = filePaths.length > 80 ? 30 : 20;
    
    for (let i = 0; i < filePaths.length; i += limit) {
      if (controller.signal.aborted) {
        throw new Error('Analysis timeout');
      }
      const chunk = filePaths.slice(i, i + limit);
      const downloadPromises = chunk.map(async (path) => {
        // Per-file timeout — skip files that take too long (prevents stalls on large repos)
        const content = await Promise.race([
          downloadFileContents(owner, repo, path),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
        ]);
        return { path, content };
      });

      const results = await Promise.allSettled(downloadPromises);
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.content !== null) {
          downloadedFiles.push({
            path: res.value.path,
            content: res.value.content
          });
        }
      }
    }

    if (downloadedFiles.length === 0) {
      return NextResponse.json({ error: 'No valid codebase files found or downloaded.' }, { status: 400 });
    }

    // Duplication Analysis
    const duplicationsList = detectDuplications(downloadedFiles);
    const duplicatedLines = duplicationsList.reduce((sum, dup) => {
      return sum + (dup.lineCount * dup.fileOccurrences.length);
    }, 0);
    const totalLines = downloadedFiles.reduce((sum, f) => sum + f.content.split('\n').length, 0);
    const duplicationRate = totalLines > 0 ? (duplicatedLines / totalLines) * 100 : 0;

    // First indexing pass: store chunks into DB for RAG dependency lookup
    const dbClient = await pool.connect();
    let tempRunId = '';
    try {
      await dbClient.query('BEGIN');
      const tempRepoRes = await dbClient.query(
        `INSERT INTO repositories (tenant_id, url, owner, name, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (url) DO UPDATE SET owner = $3, name = $4, updated_at = NOW()
         RETURNING id`,
        [defaultTenantId, cleanUrl, owner, repo]
      );
      const repositoryId = tempRepoRes.rows[0].id;

      const tempRunRes = await dbClient.query(
        `INSERT INTO analysis_runs (tenant_id, repository_id, overall_score, total_loc, avg_complexity, duplication_rate, debt_categories, estimated_debt_hours)
         VALUES ($1, $2, 'A', $3, 0, $4, '{}'::jsonb, 0)
         RETURNING id`,
        [defaultTenantId, repositoryId, totalLines, duplicationRate]
      );
      tempRunId = tempRunRes.rows[0].id;
      
      await indexRepositoryChunks(dbClient, tempRunId, downloadedFiles);
      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }

     // MAP & REDUCE PIPELINE
     const fileAnalysisResults: FileAnalysisResult[] = [];
 
     for (const file of downloadedFiles) {
       if (controller.signal.aborted) {
         throw new Error('Analysis timeout');
       }
 
       // AST-based Chunking
       const fileChunks: CodeChunk[] = chunkCodeFile(file.path, file.content);
 
       // Check if we are approaching the 270-second timeout.
       // If elapsed time exceeds 240 seconds, automatically skip LLM and fall back to local heuristics
       // to guarantee successful completion and zero serverless timeout failures!
       const elapsed = Date.now() - startTime;
       const skipLLM = elapsed > 240000;
 
       // Map Phase: Evaluate each chunk with RAG-grounded dependency context
       const chunkEvaluations = await Promise.all(
         fileChunks.map(chunk => evaluateChunkWithRAG(chunk, tempRunId, undefined, skipLLM))
       );
 
       // Reduce Phase (File Level): Rollup chunk evaluations to FileGrade
       const fileResult = reduceChunkEvaluationsToFileGrade(file.path, chunkEvaluations, file.content);
       fileAnalysisResults.push(fileResult);
     }

    // Reduce Phase (Repository Level): Rollup file results to OverallRepositoryScore
    const scorecard = reduceFileResultsToRepositoryScore(fileAnalysisResults, duplicationRate);

    // Final Database Persistence
    const mainDbClient = await pool.connect();
    try {
      await mainDbClient.query('BEGIN');

      const repoResult = await mainDbClient.query(
        `INSERT INTO repositories (tenant_id, url, owner, name, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (url) DO UPDATE SET owner = $3, name = $4, updated_at = NOW()
         RETURNING id`,
        [defaultTenantId, cleanUrl, owner, repo]
      );
      const repositoryId = repoResult.rows[0].id;

      // Update Analysis Run with Map-Reduce Scores
      const runResult = await mainDbClient.query(
        `UPDATE analysis_runs 
         SET overall_score = $1, total_loc = $2, avg_complexity = $3, duplication_rate = $4, debt_categories = $5, estimated_debt_hours = $6
         WHERE id = $7
         RETURNING id, created_at`,
        [
          scorecard.overallGrade, 
          scorecard.totalLoc, 
          scorecard.avgComplexity, 
          scorecard.duplicationRate, 
          JSON.stringify(scorecard.debtCategories),
          scorecard.estimatedDebtHours,
          tempRunId
        ]
      );
      const runId = runResult.rows[0].id;

      // Bulk Insert File Metrics
      for (const file of scorecard.files) {
        await mainDbClient.query(
          `INSERT INTO file_metrics (run_id, file_path, lines_of_code, max_nesting_depth, score, outdated_patterns_count, priority_score, review_status, recommended_action)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            runId, 
            file.filePath, 
            file.linesOfCode, 
            file.maxNestingDepth, 
            file.score, 
            file.outdatedPatternsCount, 
            file.priorityScore,
            file.reviewStatus,
            file.recommendedAction
          ]
        );
      }

      // Bulk Insert Duplications
      for (const dup of duplicationsList) {
        await mainDbClient.query(
          `INSERT INTO duplications (run_id, block_hash, line_count, file_occurrences)
           VALUES ($1, $2, $3, $4)`,
          [runId, dup.blockHash, dup.lineCount, JSON.stringify(dup.fileOccurrences)]
        );
      }

      // Add Ingestion Session Row with status done
      await mainDbClient.query(
        `INSERT INTO ingestion_sessions (tenant_id, repository_id, status, progress_step, progress_pct, triggered_by, completed_at)
         VALUES ($1, $2, 'done', 'Finalized', 100, $3, NOW())`,
        [defaultTenantId, repositoryId, triggeredBy]
      );

      await mainDbClient.query('COMMIT');

      // Fetch historical runs
      const historicalQuery = await mainDbClient.query(
        `SELECT id, overall_score, avg_complexity, duplication_rate, created_at 
         FROM analysis_runs 
         WHERE repository_id = $1 
         ORDER BY created_at DESC LIMIT 10`,
        [repositoryId]
      );

      const responseData: DashboardData = {
        run: {
          id: runId,
          repositoryId,
          overallScore: scorecard.overallGrade,
          totalLoc: scorecard.totalLoc,
          avgComplexity: scorecard.avgComplexity,
          duplicationRate: scorecard.duplicationRate,
          debtCategories: scorecard.debtCategories,
          estimatedDebtHours: scorecard.estimatedDebtHours,
          createdAt: runResult.rows[0].created_at
        },
        repository: {
          id: repositoryId,
          tenantId: defaultTenantId,
          url: cleanUrl,
          owner,
          name: repo
        },
        files: scorecard.files.map(f => ({ ...f, runId })),
        duplications: duplicationsList.map(d => ({ ...d, runId })),
        historicalRuns: historicalQuery.rows.map(h => ({
          id: h.id,
          overallScore: h.overall_score,
          avgComplexity: parseFloat(h.avg_complexity),
          duplicationRate: parseFloat(h.duplication_rate),
          createdAt: h.created_at
        }))
      };

      clearTimeout(timeoutId);
      return NextResponse.json({ cached: false, success: true, data: responseData }, { status: 200 });

    } catch (dbError) {
      await mainDbClient.query('ROLLBACK');
      throw dbError;
    } finally {
      mainDbClient.release();
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('API Error in /api/analyze:', error);
    if (error.name === 'AbortError' || error.message === 'Analysis timeout') {
      return NextResponse.json({
        error: 'Analysis timed out. This is a very large repository. Try adding a GITHUB_TOKEN to your .env.local to increase rate limits, or try analyzing a specific branch with fewer files.'
      }, { status: 504 });
    }
    if (error.message?.includes('rate limit exceeded') || error.message?.includes('API rate limit')) {
      return NextResponse.json({ 
        error: 'GitHub API rate limit reached. Please add a valid GITHUB_TOKEN to your .env.local file to enable authenticated requests.' 
      }, { status: 429 });
    }
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
