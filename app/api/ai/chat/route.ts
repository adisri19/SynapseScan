import { NextRequest, NextResponse } from 'next/server';
import { reasoningEngine } from '../../../../lib/reasoning-engine';

export async function POST(req: NextRequest) {
  try {
    const { message, messages, runId } = await req.json();
    const userMessage = message || (messages && messages[messages.length - 1]?.content) || '';

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    const reasoningResult = await reasoningEngine.executeReasoning({
      runId,
      query: userMessage,
      taskType: 'chat',
      retrievalLimit: 4
    });

    return NextResponse.json({ 
      success: true, 
      text: reasoningResult.text,
      modelUsed: reasoningResult.modelUsed,
      retrievedChunksCount: reasoningResult.retrievedChunksCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/chat:', error);
    return NextResponse.json({ error: 'Internal server error processing chat message.' }, { status: 500 });
  }
}
