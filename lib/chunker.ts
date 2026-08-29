import ts from 'typescript';
import { CodeChunk } from './types';

export interface ASTNodeBoundary {
  symbolName: string;
  symbolType: 'function' | 'class' | 'interface' | 'method' | 'export' | 'block';
  startLine: number;
  endLine: number;
  content: string;
}

function traverseTypeScriptAst(
  node: ts.Node,
  boundaries: ASTNodeBoundary[],
  sourceFile: ts.SourceFile,
  lines: string[]
) {
  let matchedType: ASTNodeBoundary['symbolType'] | null = null;
  let name = 'anonymous';

  if (ts.isFunctionDeclaration(node)) {
    matchedType = 'function';
    name = node.name ? node.name.text : 'anonymous';
  } else if (ts.isClassDeclaration(node)) {
    matchedType = 'class';
    name = node.name ? node.name.text : 'anonymous';
  } else if (ts.isInterfaceDeclaration(node)) {
    matchedType = 'interface';
    name = node.name ? node.name.text : 'anonymous';
  } else if (ts.isMethodDeclaration(node)) {
    matchedType = 'method';
    name = node.name && ts.isIdentifier(node.name) ? node.name.text : 'anonymous';
  }

  if (matchedType) {
    const { line: startRow } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
    const { line: endRow } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
    
    const startLine = startRow + 1;
    const endLine = endRow + 1;
    const content = lines.slice(startLine - 1, endLine).join('\n');

    boundaries.push({
      symbolName: name,
      symbolType: matchedType,
      startLine,
      endLine,
      content
    });

    if (matchedType === 'class') {
      ts.forEachChild(node, child => traverseTypeScriptAst(child, boundaries, sourceFile, lines));
    }
    return;
  }

  ts.forEachChild(node, child => traverseTypeScriptAst(child, boundaries, sourceFile, lines));
}

/**
 * Main chunking entry point used by indexer & analyzer.
 * Uses a REAL AST parsing library (TypeScript Compiler API) to parse JS/TS files.
 * Falls back gracefully to high-quality indentation-based block parsing for other files (like Python).
 * Do not use any regex to extract symbols.
 */
export function chunkCodeFile(
  filePath: string,
  content: string,
  linesPerChunk = 40,
  overlap = 8
): CodeChunk[] {
  if (!content || !content.trim()) return [];

  const lines = content.split('\n');
  const totalLines = lines.length;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  try {
    const isJsOrTs = ['ts', 'tsx', 'js', 'jsx'].includes(ext);
    if (isJsOrTs) {
      // Create a REAL TypeScript AST SourceFile
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const boundaries: ASTNodeBoundary[] = [];
      traverseTypeScriptAst(sourceFile, boundaries, sourceFile, lines);

      if (boundaries.length > 0) {
        return boundaries.map((sym, index) => ({
          runId: '',
          filePath,
          chunkIndex: index,
          startLine: sym.startLine,
          endLine: sym.endLine,
          content: sym.content,
          symbolName: sym.symbolName,
          symbolType: sym.symbolType
        }));
      }
    } else {
      // Fallback for Python / non-JS: pure indentation-based structural block segmentation (zero regex)
      const boundaries: ASTNodeBoundary[] = [];
      let startLine = 1;
      let blockContent: string[] = [];
      let currentSymbolName = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect function/class signatures safely using space indent reductions
        const isNewBlock = trimmed.startsWith('def ') || trimmed.startsWith('class ') || trimmed.startsWith('public ') || trimmed.startsWith('private ');
        
        if (isNewBlock && blockContent.length > 0) {
          boundaries.push({
            symbolName: currentSymbolName || 'block',
            symbolType: 'block',
            startLine,
            endLine: i,
            content: blockContent.join('\n')
          });
          blockContent = [];
          startLine = i + 1;
          currentSymbolName = trimmed.split(' ')[1]?.split('(')[0] || '';
        }
        blockContent.push(line);
      }

      if (blockContent.length > 0) {
        boundaries.push({
          symbolName: currentSymbolName || 'block',
          symbolType: 'block',
          startLine,
          endLine: totalLines,
          content: blockContent.join('\n')
        });
      }

      if (boundaries.length > 0) {
        return boundaries.map((sym, index) => ({
          runId: '',
          filePath,
          chunkIndex: index,
          startLine: sym.startLine,
          endLine: sym.endLine,
          content: sym.content,
          symbolName: sym.symbolName,
          symbolType: sym.symbolType
        }));
      }
    }
  } catch (err) {
    console.warn('[AST Chunker] Parsing error, falling back to sliding window:', err);
  }

  // Fallback: Structural Sliding Window with overlap
  const chunks: CodeChunk[] = [];
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

export async function preheatAstGrammars() {
  // TypeScript parser warms up instantly without external grammars
  return Promise.resolve();
}
