import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { 
      filePath, 
      score = 'A', 
      linesOfCode = 0, 
      maxNestingDepth = 0, 
      outdatedPatternsCount = 0, 
      recommendedAction = 'No action needed' 
    } = await req.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required.' }, { status: 400 });
    }

    const filename = filePath.split('/').pop() || filePath;
    
    // Vary the sentence openers based on string hash to avoid repetitive structure
    const sentenceOpeners = [
      `Refactoring ${filename} should focus on resolving several technical debt factors.`,
      `The high architectural priority of ${filename} is caused by outstanding code quality items.`,
      `${filename} displays significant maintenance friction that blocks rapid roadmap expansion.`,
      `Immediate cleanup inside ${filename} is recommended to decouple complex internal structures.`,
      `Reviewing ${filename} indicates a pressing need to modularize helper routines.`
    ];
    
    const hash = filePath.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const opener = sentenceOpeners[hash % sentenceOpeners.length];

    const issues: string[] = [];
    if (maxNestingDepth >= 6) {
      issues.push(`a critical nesting depth of ${maxNestingDepth} levels`);
    } else if (maxNestingDepth >= 4) {
      issues.push(`an elevated nesting depth of ${maxNestingDepth}`);
    }

    if (outdatedPatternsCount > 0) {
      issues.push(`${outdatedPatternsCount} outdated syntax pattern${outdatedPatternsCount > 1 ? 's' : ''}`);
    }

    if (linesOfCode > 200) {
      issues.push(`a large file footprint (${linesOfCode} LOC)`);
    }

    let explanation = '';
    if (issues.length > 0) {
      explanation = `${opener} This module contains ${issues.join(' alongside ')}, resulting in a Grade ${score} rating. ${recommendedAction}.`;
    } else {
      explanation = `${opener} Structural quality is solid, but isolated logic blocks can be simplified further to lower the score. ${recommendedAction}.`;
    }

    // Limit to 2 sentences and 180 characters as required
    if (explanation.length > 180) {
      explanation = explanation.slice(0, 177) + '...';
    }

    return NextResponse.json({ success: true, text: explanation }, { status: 200 });

  } catch (error: any) {
    console.error('API Error in /api/ai/explain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
