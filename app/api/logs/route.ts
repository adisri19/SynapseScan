import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET(req: NextRequest) {
  try {
    // Join analysis runs, repos, and sessions to fetch log registry details
    const logsQuery = await query(
      `SELECT 
        ar.id AS "runId",
        r.url AS "repoUrl",
        r.owner AS "owner",
        r.name AS "name",
        COALESCE(s.status, 'done') AS "status",
        ar.total_loc AS "totalLoc",
        ar.overall_score AS "overallScore",
        COALESCE(s.triggered_by, 'Enterprise Administrator') AS "triggeredBy",
        ar.created_at AS "createdAt",
        COALESCE(s.completed_at, ar.created_at) AS "completedAt",
        (SELECT COUNT(*) FROM file_metrics WHERE run_id = ar.id) AS "analyzedFilesCount"
       FROM analysis_runs ar
       JOIN repositories r ON ar.repository_id = r.id
       LEFT JOIN ingestion_sessions s ON ar.repository_id = s.repository_id AND s.created_at >= ar.created_at - INTERVAL '1 minute' AND s.created_at <= ar.created_at + INTERVAL '1 minute'
       ORDER BY ar.created_at DESC
       LIMIT 50`
    );

    const data = logsQuery.rows.map(row => ({
      runId: row.runId,
      repoUrl: row.repoUrl,
      owner: row.owner,
      name: row.name,
      status: row.status,
      analyzedFilesCount: parseInt(row.analyzedFilesCount) || 0,
      errorCount: 0, // placeholder as specified in requirements
      triggeredBy: row.triggeredBy,
      createdAt: row.createdAt,
      completedAt: row.completedAt
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
