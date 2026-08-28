import { NextRequest, NextResponse } from 'next/server';
import { parseGitLabUrl, fetchGitLabRepositoryTree, downloadGitLabFileContents } from '../../../lib/gitlab';
import { calculateNestingDepth, detectDuplications, scanOutdatedPatterns, scoreCodebase } from '../../../lib/analyzer';
import { query, pool } from '../../../lib/db';
import { DashboardData } from '../../../lib/types';

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 85000);

  const defaultTenantId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  try {
    const { repoUrl, triggeredBy = 'Enterprise Administrator' } = await req.json();

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required.' }, { status: 400 });
    }

    if (!repoUrl.startsWith('https://gitlab.com/')) {
      return NextResponse.json({ error: 'Repository URL must start with https://gitlab.com/' }, { status: 400 });
    }

    let owner = '';
    let repo = '';
    let branch = '';

    try {
      const parsed = parseGitLabUrl(repoUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      branch = parsed.branch;
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Invalid GitLab URL' }, { status: 400 });
    }

    const cleanUrl = `https://gitlab.com/${owner}/${repo}`;

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
      filePaths = await fetchGitLabRepositoryTree(owner, repo, branch);
    } catch (e: any) {
      if (e.message?.includes('Not Found') || e.message?.includes('404')) {
        return NextResponse.json({ error: 'GitLab repository not found.' }, { status: 404 });
      }
      throw e;
    }

    const downloadedFiles: Array<{ path: string; content: string }> = [];
    const limit = 20;
    
    for (let i = 0; i < filePaths.length; i += limit) {
      if (controller.signal.aborted) {
        throw new Error('Analysis timeout');
      }
      const chunk = filePaths.slice(i, i + limit);
      const downloadPromises = chunk.map(async (path) => {
        const content = await downloadGitLabFileContents(owner, repo, path, branch);
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
      return NextResponse.json({ error: 'No valid GitLab codebase files found or downloaded.' }, { status: 400 });
    }

    const filesStats = downloadedFiles.map(file => {
      const loc = file.content.split('\n').length;
      const nestingDepth = calculateNestingDepth(file.content);
      const outdatedCount = scanOutdatedPatterns(file.content);

      return {
        path: file.path,
        loc,
        nestingDepth,
        outdatedCount,
        content: file.content
      };
    });

    const duplicationsList = detectDuplications(downloadedFiles);

    const duplicatedLines = duplicationsList.reduce((sum, dup) => {
      return sum + (dup.lineCount * dup.fileOccurrences.length);
    }, 0);
    const totalLines = filesStats.reduce((sum, f) => sum + f.loc, 0);
    const duplicationRate = totalLines > 0 ? (duplicatedLines / totalLines) * 100 : 0;

    const scorecard = scoreCodebase(filesStats, duplicationRate);

    // 3. Database Transaction
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      const repoResult = await dbClient.query(
        `INSERT INTO repositories (tenant_id, url, owner, name, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (url) DO UPDATE SET owner = $3, name = $4, updated_at = NOW()
         RETURNING id`,
        [defaultTenantId, cleanUrl, owner, repo]
      );
      const repositoryId = repoResult.rows[0].id;

      const runResult = await dbClient.query(
        `INSERT INTO analysis_runs (tenant_id, repository_id, overall_score, total_loc, avg_complexity, duplication_rate, debt_categories, estimated_debt_hours)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at`,
        [
          defaultTenantId, 
          repositoryId, 
          scorecard.overallGrade, 
          scorecard.totalLoc, 
          scorecard.avgComplexity, 
          scorecard.duplicationRate, 
          JSON.stringify(scorecard.debtCategories),
          scorecard.estimatedDebtHours
        ]
      );
      const runId = runResult.rows[0].id;

      for (const file of scorecard.files) {
        await dbClient.query(
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

      for (const dup of duplicationsList) {
        await dbClient.query(
          `INSERT INTO duplications (run_id, block_hash, line_count, file_occurrences)
           VALUES ($1, $2, $3, $4)`,
          [runId, dup.blockHash, dup.lineCount, JSON.stringify(dup.fileOccurrences)]
        );
      }

      await dbClient.query(
        `INSERT INTO ingestion_sessions (tenant_id, repository_id, status, progress_step, progress_pct, triggered_by, completed_at)
         VALUES ($1, $2, 'done', 'Finalized', 100, $3, NOW())`,
        [defaultTenantId, repositoryId, triggeredBy]
      );

      await dbClient.query('COMMIT');

      const historicalQuery = await dbClient.query(
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
      await dbClient.query('ROLLBACK');
      throw dbError;
    } finally {
      dbClient.release();
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('API Error in /api/analyze-gitlab:', error);
    if (error.name === 'AbortError' || error.message === 'Analysis timeout') {
      return NextResponse.json({ error: 'Analysis execution exceeded 90 seconds timeout.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
