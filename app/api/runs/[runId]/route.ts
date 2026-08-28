import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { DashboardData } from '../../../../lib/types';

export async function GET(req: NextRequest, { params }: { params: { runId: string } }) {
  try {
    const { runId } = params;

    if (!runId) {
      return NextResponse.json({ error: 'runId parameter is required.' }, { status: 400 });
    }

    const runQuery = await query(
      `SELECT id, repository_id, overall_score, total_loc, avg_complexity, duplication_rate, debt_categories, estimated_debt_hours, created_at 
       FROM analysis_runs 
       WHERE id = $1`,
      [runId]
    );

    if (runQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Analysis run not found.' }, { status: 404 });
    }

    const run = runQuery.rows[0];
    const repositoryId = run.repository_id;

    // Fetch repository details
    const repoQuery = await query(
      `SELECT id, tenant_id, url, owner, name FROM repositories WHERE id = $1`,
      [repositoryId]
    );

    if (repoQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Repository reference not found.' }, { status: 404 });
    }
    const repository = repoQuery.rows[0];

    const filesQuery = await query(
      `SELECT id, file_path, lines_of_code, max_nesting_depth, score, outdated_patterns_count, priority_score, review_status, recommended_action 
       FROM file_metrics WHERE run_id = $1`,
      [runId]
    );

    const dupsQuery = await query(
      `SELECT id, block_hash, line_count, file_occurrences 
       FROM duplications WHERE run_id = $1`,
      [runId]
    );

    // Fetch last 10 historical runs for trends chart
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
        createdAt: run.created_at
      },
      repository: {
        id: repository.id,
        tenantId: repository.tenant_id,
        url: repository.url,
        owner: repository.owner,
        name: repository.name
      },
      files: filesQuery.rows.map(row => ({
        id: row.id,
        runId,
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
        id: row.id,
        runId,
        blockHash: row.block_hash,
        lineCount: row.line_count,
        fileOccurrences: row.file_occurrences
      })),
      historicalRuns: historicalQuery.rows.map(h => ({
        id: h.id,
        overallScore: h.overall_score,
        avgComplexity: parseFloat(h.avg_complexity),
        duplicationRate: parseFloat(h.duplication_rate),
        createdAt: h.created_at
      }))
    };

    return NextResponse.json({ success: true, data: responseData }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/runs/[runId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
