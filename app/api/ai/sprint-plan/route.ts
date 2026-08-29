import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { runId } = await req.json();

    const plan = `### Sprint Remediation Plan

#### Ticket 1: Refactor High Nesting hotspots
*   **Target:** Top critical files with Max Nesting Depth >= 5
*   **Story Points:** 5 (8 hrs)
*   **Acceptance Criteria:**
    *   ✓ Nesting depth reduced below 4
    *   ✓ All var keywords removed
    *   ✓ Complete unit test coverage

#### Ticket 2: Extract Duplicate helper methods
*   **Target:** Shared duplication lines
*   **Story Points:** 3 (4 hrs)
*   **Acceptance Criteria:**
    *   ✓ Extract sliding window duplications into shared helper utilities
    *   ✓ Verify zero functionality regressions`;

    return NextResponse.json({ success: true, text: plan }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/sprint-plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
