import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { filePath, runId } = await req.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required.' }, { status: 400 });
    }

    const refactoredCode = `// AI Refactored version of: ${filePath}
// Goal: Reduce nested scopes, remove var statements, and isolate utility handlers.

export function handleAction(config) {
  if (!config) {
    throw new Error('Config missing');
  }

  const { data, options } = config;
  return processData(data, options);
}

function processData(data, options) {
  if (!data || data.length === 0) {
    return [];
  }

  return data.map(item => sanitizeItem(item, options));
}

function sanitizeItem(item, options) {
  const cleanId = item.id || 'default_id';
  const val = item.value || 0;
  
  return {
    ...item,
    id: cleanId,
    score: val * (options?.multiplier || 1)
  };
}`;

    return NextResponse.json({ success: true, text: refactoredCode }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/refactor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
