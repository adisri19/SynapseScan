import { CodeChunk } from './types';

/**
 * Advanced Symbol-Aware Code Chunking Engine.
 * Extracts functions, classes, methods, exports, and interfaces for TS/JS/Python/Java,
 * falling back to sliding window chunking with line overlaps for other files.
 */
export function chunkCodeFile(
  filePath: string,
  content: string,
  linesPerChunk = 35,
  overlap = 7
): CodeChunk[] {
  if (!content || !content.trim()) return [];

  const lines = content.split('\n');
  const totalLines = lines.length;
  const chunks: CodeChunk[] = [];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  // 1. Symbol-based chunking for TS, JS, JSX, TSX, PY, JAVA, C, CPP, GO, RS
  const symbolChunks = extractSymbolChunks(filePath, lines, ext);
  if (symbolChunks.length > 0) {
    return symbolChunks;
  }

  // 2. Fallback: Intelligent Line-Sliding Window with overlap
  let chunkIndex = 0;
  let startLine = 1;

  while (startLine <= totalLines) {
    const endLine = Math.min(totalLines, startLine + linesPerChunk - 1);
    const chunkLines = lines.slice(startLine - 1, endLine);
    const chunkText = chunkLines.join('\n');

    if (chunkText.trim().length > 0) {
      chunks.push({
        runId: '',
        filePath,
        chunkIndex,
        startLine,
        endLine,
        content: chunkText,
        symbolType: 'block'
      });
      chunkIndex++;
    }

    if (endLine >= totalLines) break;
    startLine += linesPerChunk - overlap;
  }

  return chunks;
}

/**
 * Extracts structural symbols (functions, classes, interfaces, components) using regex patterns
 */
function extractSymbolChunks(filePath: string, lines: string[], ext: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  if (!['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'cs'].includes(ext)) {
    return chunks;
  }

  let currentSymbolName: string | undefined = undefined;
  let currentSymbolType: CodeChunk['symbolType'] = undefined;
  let symbolStartLine = 1;
  let currentLines: string[] = [];
  let chunkIndex = 0;

  // Regex patterns for JS/TS/React/Python/Java/Go symbol detection
  const fnPattern = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/;
  const classPattern = /(?:export\s+)?class\s+([A-Za-z0-9_]+)/;
  const interfacePattern = /(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_]+)/;
  const pyFnPattern = /def\s+([A-Za-z0-9_]+)\s*\(/;
  const pyClassPattern = /class\s+([A-Za-z0-9_]+)/;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];

    let matchedSymbol: string | undefined;
    let matchedType: CodeChunk['symbolType'];

    const fnMatch = lineText.match(fnPattern) || lineText.match(pyFnPattern);
    if (fnMatch) {
      matchedSymbol = fnMatch[1] || fnMatch[2];
      matchedType = 'function';
    } else {
      const classMatch = lineText.match(classPattern) || lineText.match(pyClassPattern);
      if (classMatch) {
        matchedSymbol = classMatch[1];
        matchedType = 'class';
      } else {
        const intMatch = lineText.match(interfacePattern);
        if (intMatch) {
          matchedSymbol = intMatch[1];
          matchedType = 'interface';
        }
      }
    }

    // When a new symbol starts and we already accumulated lines (>15 lines or new symbol), save previous chunk
    if (matchedSymbol && currentLines.length > 0) {
      const chunkText = currentLines.join('\n');
      if (chunkText.trim().length > 0) {
        chunks.push({
          runId: '',
          filePath,
          chunkIndex,
          startLine: symbolStartLine,
          endLine: lineNum - 1,
          content: chunkText,
          symbolName: currentSymbolName,
          symbolType: currentSymbolType || 'block'
        });
        chunkIndex++;
      }
      currentLines = [];
      symbolStartLine = lineNum;
      currentSymbolName = matchedSymbol;
      currentSymbolType = matchedType;
    } else if (matchedSymbol && currentLines.length === 0) {
      currentSymbolName = matchedSymbol;
      currentSymbolType = matchedType;
    }

    currentLines.push(lineText);

    // If accumulated block reaches ~40 lines without symbol change, split chunk
    if (currentLines.length >= 40) {
      const chunkText = currentLines.join('\n');
      chunks.push({
        runId: '',
        filePath,
        chunkIndex,
        startLine: symbolStartLine,
        endLine: lineNum,
        content: chunkText,
        symbolName: currentSymbolName,
        symbolType: currentSymbolType || 'block'
      });
      chunkIndex++;
      currentLines = [];
      symbolStartLine = lineNum + 1;
    }
  }

  // Push trailing lines
  if (currentLines.length > 0) {
    const chunkText = currentLines.join('\n');
    if (chunkText.trim().length > 0) {
      chunks.push({
        runId: '',
        filePath,
        chunkIndex,
        startLine: symbolStartLine,
        endLine: lines.length,
        content: chunkText,
        symbolName: currentSymbolName,
        symbolType: currentSymbolType || 'block'
      });
    }
  }

  return chunks;
}
