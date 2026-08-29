import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { filePath, runId } = await req.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required.' }, { status: 400 });
    }

    const explanation = `This file exhibits structural maintenance concerns primarily due to deeply nested braces and code blocks. This high cognitive complexity hinders readability and introduces testing friction. Extracting nested scopes into clean, pure functions will simplify the logic profile and lower priority scores.`;

    return NextResponse.json({ success: true, text: explanation }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/explain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
