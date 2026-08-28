import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const { repoUrl, secretToken, events } = await req.json();

    if (!repoUrl || !secretToken || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Missing required configuration parameters.' }, { status: 400 });
    }

    // Save/Upsert configuration
    await query(
      `INSERT INTO webhook_configs (repo_url, secret_token, events, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [repoUrl, secretToken, JSON.stringify(events)]
    );

    return NextResponse.json({ success: true, webhookUrl: '/api/webhook/analyze' }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/webhook/config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
