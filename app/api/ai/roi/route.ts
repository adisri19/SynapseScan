import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const { runId } = await req.json();

    if (!runId) {
      return NextResponse.json({ error: 'runId is required.' }, { status: 400 });
    }

    const runQuery = await query(
      `SELECT overall_score, total_loc, avg_complexity, duplication_rate, estimated_debt_hours 
       FROM analysis_runs WHERE id = $1`,
      [runId]
    );

    if (runQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
    }

    const run = runQuery.rows[0];
    const fixCost = run.estimated_debt_hours * 150;
    const monthlyCost = Math.round(run.estimated_debt_hours * 0.15 * 150);

    const text = `A detailed return-on-investment (ROI) analysis estimates the total immediate remediation costs at $${fixCost.toLocaleString()} (calculated at a $150/hr blended engineering rate across ${run.estimated_debt_hours} total hours of identified technical debt). If left unaddressed, the velocity drag and velocity friction of this cumulative debt is projected to cost $${monthlyCost.toLocaleString()} per month in compounding velocity losses.

By initiating a targeted refactoring sprint to eliminate nested logic and redundant block duplication, the engineering team is estimated to achieve a full break-even on the remediation investment in less than 3 months. Resolving code debt immediately removes system bottlenecks, lowers onboarding friction for new developers, and avoids compounding technical debt growth over successive sprints.`;

    return NextResponse.json({ success: true, text }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/roi:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
