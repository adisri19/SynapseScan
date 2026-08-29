import { NextRequest, NextResponse } from 'next/server';
import { reasoningEngine } from '../../../../lib/reasoning-engine';

export async function POST(req: NextRequest) {
  try {
    const { filePath, runId } = await req.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required.' }, { status: 400 });
    }

    const query = `Provide refactored code for ${filePath} that eliminates nesting, removes var keywords, and isolates functions cleanly.`;

    const reasoningResult = await reasoningEngine.executeReasoning({
      runId,
      query,
      taskType: 'refactor',
      targetFilePath: filePath,
      retrievalLimit: 3
    });

    return NextResponse.json({ 
      success: true, 
      text: reasoningResult.text,
      modelUsed: reasoningResult.modelUsed,
      retrievedChunksCount: reasoningResult.retrievedChunksCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/refactor:', error);
    return NextResponse.json({ error: 'Internal server error processing refactor request.' }, { status: 500 });
  }
}
