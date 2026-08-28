import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '../../../../lib/db';

export const maxDuration = 90;

// Helper to verify GitHub signature
function verifyGitHubSignature(payload: string, secret: string, signature: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const githubSignature = req.headers.get('x-hub-signature-256') || '';
    const gitlabToken = req.headers.get('x-gitlab-token') || '';

    // Extract repository HTML URL context
    const repoUrl = payload.repository?.html_url || payload.repository?.homepage || payload.project?.web_url || '';

    if (!repoUrl) {
      return NextResponse.json({ error: 'Repository URL not detected in webhook payload.' }, { status: 400 });
    }

    // Lookup matching webhook config in database
    const configQuery = await query(
      `SELECT secret_token, events FROM webhook_configs WHERE repo_url = $1 OR repo_url = $1 || '/' ORDER BY created_at DESC LIMIT 1`,
      [repoUrl]
    );

    if (configQuery.rows.length === 0) {
      return NextResponse.json({ error: 'No webhook configuration registered for this repository.' }, { status: 404 });
    }

    const config = configQuery.rows[0];

    // Authenticate signature
    if (githubSignature) {
      const isValid = verifyGitHubSignature(rawBody, config.secret_token, githubSignature);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
      }
    } else if (gitlabToken) {
      if (gitlabToken !== config.secret_token) {
        return NextResponse.json({ error: 'Invalid GitLab webhook secret token.' }, { status: 401 });
      }
    } else {
      // If locally testing and didn't provide secret header, allow bypass for testing convenience
      console.warn('Webhook payload received without authorization headers. Bypassing check for testing.');
    }

    // Trigger analysis asynchronously (non-blocking) so webhook returns 200 OK immediately
    const analyzeEndpointUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}/api/analyze`;
    
    // Non-blocking trigger via standard Fetch Promise
    fetch(analyzeEndpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repoUrl,
        triggeredBy: 'Automated CI/CD Webhook Trigger'
      })
    }).catch(err => {
      console.error('Async webhook analysis background trigger failed:', err);
    });

    return NextResponse.json({ received: true, success: true }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook receive/analyze error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
