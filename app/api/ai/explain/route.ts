import { NextRequest, NextResponse } from 'next/server';
import { reasoningEngine } from '../../../../lib/reasoning-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      filePath, 
      runId,
      score = 'A', 
      linesOfCode = 0, 
      maxNestingDepth = 0, 
      outdatedPatternsCount = 0, 
      recommendedAction = 'No action needed' 
    } = body;

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required.' }, { status: 400 });
    }

    const query = `Explain code quality rating for ${filePath} with ${linesOfCode} LOC, nesting depth ${maxNestingDepth}, outdated patterns ${outdatedPatternsCount}, and action: ${recommendedAction}`;

    const reasoningResult = await reasoningEngine.executeReasoning({
      runId,
      query,
      taskType: 'explain',
      targetFilePath: filePath,
      retrievalLimit: 3
    });

    let explanation = reasoningResult.text;
    if (explanation.length > 220) {
      explanation = explanation.slice(0, 217) + '...';
    }

    return NextResponse.json({ 
      success: true, 
      text: explanation,
      modelUsed: reasoningResult.modelUsed,
      retrievedChunksCount: reasoningResult.retrievedChunksCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/explain:', error);
    return NextResponse.json({ error: 'Internal server error processing explain request.' }, { status: 500 });
  }
}
