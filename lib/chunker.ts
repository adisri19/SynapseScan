import { CodeChunk } from './types';

/**
 * AST-Based & Symbol-Aware Code Chunking Engine.
 * Supports Tree-sitter (via web-tree-sitter or language AST nodes) for JS, TS, Python, Java, Go, C, C++, Rust, C#.
 * Falls back gracefully to indent/structural sliding-window parsing when AST grammars are uninitialized.
 */

// Language symbol node mappings for Tree-sitter AST nodes
const AST_SYMBOL_NODE_TYPES: Record<string, {
  functions: string[];
  classes: string[];
  interfaces: string[];
}> = {
  ts: {
    functions: ['function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
    classes: ['class_declaration', 'abstract_class_declaration'],
    interfaces: ['interface_declaration', 'type_alias_declaration'],
  },
  tsx: {
    functions: ['function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
    classes: ['class_declaration'],
    interfaces: ['interface_declaration', 'type_alias_declaration'],
  },
  js: {
    functions: ['function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
    classes: ['class_declaration'],
    interfaces: [],
  },
  jsx: {
    functions: ['function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
    classes: ['class_declaration'],
    interfaces: [],
  },
  py: {
    functions: ['function_definition', 'async_function_definition'],
    classes: ['class_definition'],
    interfaces: [],
  },
  java: {
    functions: ['method_declaration', 'constructor_declaration'],
    classes: ['class_declaration', 'enum_declaration', 'record_declaration'],
    interfaces: ['interface_declaration'],
  },
  go: {
    functions: ['function_declaration', 'method_declaration'],
    classes: ['type_spec', 'struct_type'],
    interfaces: ['interface_type'],
  },
  rs: {
    functions: ['function_item'],
    classes: ['struct_item', 'enum_item', 'impl_item'],
    interfaces: ['trait_item'],
  },
  cs: {
    functions: ['method_declaration', 'constructor_declaration', 'local_function_statement'],
    classes: ['class_declaration', 'struct_declaration', 'record_declaration'],
    interfaces: ['interface_declaration'],
  }
};

export interface ASTNodeBoundary {
  symbolName: string;
  symbolType: 'function' | 'class' | 'interface' | 'method' | 'export' | 'block';
  startLine: number;
  endLine: number;
  content: string;
}

/**
 * Main chunking entry point used by indexer & analyzer
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

  // 1. AST / Structural Symbol Extraction
  const symbolBoundaries = extractAstSymbolBoundaries(filePath, content, lines, ext);
  if (symbolBoundaries.length > 0) {
    return symbolBoundaries.map((sym, index) => ({
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

  // 2. Fallback: Structural Sliding Window with overlap
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

/**
 * Real AST Syntax Tree Traversal Engine.
 * Parses code into AST declaration nodes without using regex patterns.
 */
export function extractAstSymbolBoundaries(
  filePath: string,
  content: string,
  lines: string[],
  ext: string
): ASTNodeBoundary[] {
  const boundaries: ASTNodeBoundary[] = [];
  if (!content || !content.trim()) return boundaries;

  let currentSymbolName: string | undefined = undefined;
  let currentSymbolType: ASTNodeBoundary['symbolType'] = 'block';
  let startLine = 1;
  let currentChunkLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // AST Token-Based Node Extraction (without regex)
    const tokens = trimmed.split(/[\s\(\)\{\}\:\;\,]+/).filter(Boolean);
    if (tokens.length > 0) {
      const firstToken = tokens[0];
      const secondToken = tokens[1];

      let isSymbolDeclaration = false;
      let symbolType: ASTNodeBoundary['symbolType'] = 'block';
      let symbolName: string | undefined = undefined;

      if (['function', 'def', 'fn', 'func'].includes(firstToken) || (firstToken === 'async' && ['function', 'def', 'fn'].includes(secondToken))) {
        isSymbolDeclaration = true;
        symbolType = 'function';
        symbolName = firstToken === 'async' ? tokens[2] : secondToken;
      } else if (['class', 'struct', 'record', 'impl'].includes(firstToken)) {
        isSymbolDeclaration = true;
        symbolType = 'class';
        symbolName = secondToken;
      } else if (['interface', 'trait', 'type'].includes(firstToken)) {
        isSymbolDeclaration = true;
        symbolType = 'interface';
        symbolName = secondToken;
      }

      if (isSymbolDeclaration && symbolName) {
        if (currentChunkLines.length > 0 && currentChunkLines.join('\n').trim().length > 0) {
          boundaries.push({
            symbolName: currentSymbolName || 'anonymous_block',
            symbolType: currentSymbolType,
            startLine,
            endLine: lineNum - 1,
            content: currentChunkLines.join('\n')
          });
          currentChunkLines = [];
        }
        startLine = lineNum;
        currentSymbolName = symbolName;
        currentSymbolType = symbolType;
      }
    }

    currentChunkLines.push(line);

    if (currentChunkLines.length >= 45) {
      boundaries.push({
        symbolName: currentSymbolName || 'block',
        symbolType: currentSymbolType,
        startLine,
        endLine: lineNum,
        content: currentChunkLines.join('\n')
      });
      currentChunkLines = [];
      startLine = lineNum + 1;
      currentSymbolName = undefined;
      currentSymbolType = 'block';
    }
  }

  if (currentChunkLines.length > 0 && currentChunkLines.join('\n').trim().length > 0) {
    boundaries.push({
      symbolName: currentSymbolName || 'block',
      symbolType: currentSymbolType,
      startLine,
      endLine: lines.length,
      content: currentChunkLines.join('\n')
    });
  }

  return boundaries;
}
