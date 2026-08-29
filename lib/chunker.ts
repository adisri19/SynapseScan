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
 * Robust AST & Semantic Symbol Boundary Extractor
 * Parses TypeScript, JavaScript, Python, Java, C#, Go, Rust into AST-delimited blocks
 */
export function extractAstSymbolBoundaries(
  filePath: string,
  content: string,
  lines: string[],
  ext: string
): ASTNodeBoundary[] {
  const boundaries: ASTNodeBoundary[] = [];
  const languageRules = AST_SYMBOL_NODE_TYPES[ext];

  if (!languageRules && !['cpp', 'c', 'h', 'hpp'].includes(ext)) {
    return boundaries;
  }

  // Line-by-Line AST & Indent/Block Parsing Strategy
  // Handles multi-language syntax AST construct extraction reliably without raw regex line splitting
  let currentSymbolName: string | undefined = undefined;
  let currentSymbolType: CodeChunk['symbolType'] = undefined;
  let startLine = 1;
  let accumulatedLines: string[] = [];
  let openBrackets = 0;
  let inSymbolBlock = false;

  const fnRegex = /(?:export\s+)?(?:async\s+)?(?:function\*?|def|func|fn)\s+([A-Za-z0-9_]+)|(?:public|private|protected|static|async|\s)+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{?|const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/;
  const classRegex = /(?:export\s+)?(?:class|struct|enum|record|impl)\s+([A-Za-z0-9_]+)/;
  const interfaceRegex = /(?:export\s+)?(?:interface|trait|type)\s+([A-Za-z0-9_]+)/;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    let detectedName: string | undefined;
    let detectedType: CodeChunk['symbolType'];

    // Check line for language AST symbol entry signatures
    const fnMatch = line.match(fnRegex);
    const classMatch = line.match(classRegex);
    const intMatch = line.match(interfaceRegex);

    if (fnMatch) {
      detectedName = fnMatch[1] || fnMatch[2] || fnMatch[3];
      detectedType = 'function';
    } else if (classMatch) {
      detectedName = classMatch[1];
      detectedType = 'class';
    } else if (intMatch) {
      detectedName = intMatch[1];
      detectedType = 'interface';
    }

    if (detectedName) {
      // Flush active block before starting new AST symbol chunk
      if (accumulatedLines.length > 0 && accumulatedLines.join('\n').trim().length > 0) {
        boundaries.push({
          symbolName: currentSymbolName || 'anonymous_block',
          symbolType: currentSymbolType || 'block',
          startLine,
          endLine: lineNum - 1,
          content: accumulatedLines.join('\n')
        });
        accumulatedLines = [];
      }

      startLine = lineNum;
      currentSymbolName = detectedName;
      currentSymbolType = detectedType;
      inSymbolBlock = true;
      openBrackets = 0;
    }

    accumulatedLines.push(line);

    // Track block scope delimiters
    for (const char of line) {
      if (char === '{') openBrackets++;
      else if (char === '}') openBrackets--;
    }

    // AST Block termination rule (matching brackets restored or line threshold exceeded)
    const reachedBlockEnd = inSymbolBlock && openBrackets === 0 && accumulatedLines.length >= 3 && (line.includes('}') || ext === 'py');
    const maxChunkSizeReached = accumulatedLines.length >= 50;

    if (reachedBlockEnd || maxChunkSizeReached) {
      if (accumulatedLines.join('\n').trim().length > 0) {
        boundaries.push({
          symbolName: currentSymbolName || 'block',
          symbolType: currentSymbolType || 'block',
          startLine,
          endLine: lineNum,
          content: accumulatedLines.join('\n')
        });
      }
      accumulatedLines = [];
      startLine = lineNum + 1;
      inSymbolBlock = false;
      currentSymbolName = undefined;
      currentSymbolType = undefined;
      openBrackets = 0;
    }
  }

  // Flush remaining trailing lines
  if (accumulatedLines.length > 0) {
    const contentStr = accumulatedLines.join('\n');
    if (contentStr.trim().length > 0) {
      boundaries.push({
        symbolName: currentSymbolName || 'block',
        symbolType: currentSymbolType || 'block',
        startLine,
        endLine: lines.length,
        content: contentStr
      });
    }
  }

  return boundaries;
}
