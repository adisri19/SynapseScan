import { query, pool } from './db';

export interface CodeChunk {
  id?: string;
  runId: string;
  filePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  score?: number;
}

/**
 * Ensures the code_chunks table exists in PostgreSQL.
 */
export async function ensureRagTableExists(client?: any) {
  const runner = client || pool;
  await runner.query(`
    CREATE TABLE IF NOT EXISTS code_chunks (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      run_id       UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      file_path    VARCHAR NOT NULL,
      chunk_index  INTEGER NOT NULL,
      start_line   INTEGER NOT NULL DEFAULT 1,
      end_line     INTEGER NOT NULL DEFAULT 1,
      content      TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_code_chunks_run_id ON code_chunks(run_id);
  `);
}

/**
 * Splits a source file into overlapping code chunks (e.g. 30 lines per chunk, 5-line overlap).
 */
export function chunkCodeFile(filePath: string, content: string, linesPerChunk = 30, overlap = 5): Array<{ chunkIndex: number; startLine: number; endLine: number; content: string }> {
  if (!content || !content.trim()) return [];

  const lines = content.split('\n');
  const totalLines = lines.length;
  const chunks: Array<{ chunkIndex: number; startLine: number; endLine: number; content: string }> = [];

  let chunkIndex = 0;
  let startLine = 1;

  while (startLine <= totalLines) {
    const endLine = Math.min(totalLines, startLine + linesPerChunk - 1);
    const chunkLines = lines.slice(startLine - 1, endLine);
    const chunkText = chunkLines.join('\n');

    if (chunkText.trim().length > 0) {
      chunks.push({
        chunkIndex,
        startLine,
        endLine,
        content: chunkText
      });
      chunkIndex++;
    }

    if (endLine >= totalLines) break;
    startLine += linesPerChunk - overlap;
  }

  return chunks;
}

/**
 * Stores all chunks for a repository run into PostgreSQL.
 */
export async function indexRepositoryChunks(dbClient: any, runId: string, downloadedFiles: Array<{ path: string; content: string }>) {
  await ensureRagTableExists(dbClient);

  // Clear any existing chunks for this run
  await dbClient.query('DELETE FROM code_chunks WHERE run_id = $1', [runId]);

  for (const file of downloadedFiles) {
    const fileChunks = chunkCodeFile(file.path, file.content);

    for (const chunk of fileChunks) {
      await dbClient.query(
        `INSERT INTO code_chunks (run_id, file_path, chunk_index, start_line, end_line, content)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, file.path, chunk.chunkIndex, chunk.startLine, chunk.endLine, chunk.content]
      );
    }
  }
}

/**
 * Calculates term frequency and keyword similarity score between user prompt and code chunk content.
 */
function scoreChunkRelevance(userQuery: string, chunk: CodeChunk): number {
  const queryTerms = userQuery.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return 0;

  const contentLower = chunk.content.toLowerCase();
  const filePathLower = chunk.filePath.toLowerCase();

  let score = 0;

  for (const term of queryTerms) {
    // Direct term hit in file path is heavily weighted
    if (filePathLower.includes(term)) {
      score += 15;
    }

    // Exact word frequency in chunk content
    const matches = (contentLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
    score += matches * 3;

    // Substring occurrences
    if (contentLower.includes(term)) {
      score += 1;
    }
  }

  // Bonus points for function declarations or exported functions in chunk
  if (/function|export|class|const|async|interface|type/i.test(chunk.content)) {
    score += 2;
  }

  return score;
}

/**
 * RAG Retrieval Engine: Retrieves top-K most relevant code chunks for a user query and runId.
 */
export async function retrieveRelevantChunks(userQuery: string, runId: string, limit = 5): Promise<CodeChunk[]> {
  try {
    await ensureRagTableExists();

    const result = await query(
      `SELECT id, run_id as "runId", file_path as "filePath", chunk_index as "chunkIndex", 
              start_line as "startLine", end_line as "endLine", content 
       FROM code_chunks WHERE run_id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const scoredChunks: CodeChunk[] = result.rows.map(row => {
      const chunk: CodeChunk = {
        id: row.id,
        runId: row.runId,
        filePath: row.filePath,
        chunkIndex: row.chunkIndex,
        startLine: row.startLine,
        endLine: row.endLine,
        content: row.content
      };
      chunk.score = scoreChunkRelevance(userQuery, chunk);
      return chunk;
    });

    // Sort descending by relevance score
    scoredChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Return top K chunks that have positive relevance or top chunks overall
    const topChunks = scoredChunks.filter(c => (c.score || 0) > 0).slice(0, limit);
    return topChunks.length > 0 ? topChunks : scoredChunks.slice(0, limit);

  } catch (err) {
    console.error('Error retrieving RAG chunks:', err);
    return [];
  }
}

/**
 * Formats retrieved chunks into a clean context block to inject into the LLM prompt.
 */
export function formatRagContext(chunks: CodeChunk[]): string {
  if (!chunks || chunks.length === 0) return '';

  return chunks.map((c, i) => 
    `--- Code Snippet #${i + 1} [File: ${c.filePath} (Lines ${c.startLine}-${c.endLine})] ---\n\`\`\`\n${c.content}\n\`\`\``
  ).join('\n\n');
}
