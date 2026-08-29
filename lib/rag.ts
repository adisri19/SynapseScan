import { query, pool } from './db';
import { CodeChunk } from './types';
import { chunkCodeFile } from './chunker';
import { embeddingService, cosineSimilarity } from './embeddings';

/**
 * Ensures the code_chunks schema exists with vector embedding & symbol metadata support.
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
      symbol_name  VARCHAR(100),
      symbol_type  VARCHAR(30) DEFAULT 'block',
      content      TEXT NOT NULL,
      embedding    JSONB,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_code_chunks_run_id ON code_chunks(run_id);
    CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path ON code_chunks(file_path);
    CREATE INDEX IF NOT EXISTS idx_code_chunks_symbol_name ON code_chunks(symbol_name);
  `);
}

/**
 * Indexes repository source files into symbol-aware code chunks and embeds them for RAG search.
 */
export async function indexRepositoryChunks(
  dbClient: any,
  runId: string,
  downloadedFiles: Array<{ path: string; content: string }>
) {
  await ensureRagTableExists(dbClient);

  // Repository Isolation: purge previous chunks for this run ID
  await dbClient.query('DELETE FROM code_chunks WHERE run_id = $1', [runId]);

  for (const file of downloadedFiles) {
    const fileChunks = chunkCodeFile(file.path, file.content);
    if (fileChunks.length === 0) continue;

    const chunkContents = fileChunks.map(c => c.content);
    const embeddings = await embeddingService.embedBatch(chunkContents);

    for (let i = 0; i < fileChunks.length; i++) {
      const chunk = fileChunks[i];
      const emb = embeddings[i] || [];

      await dbClient.query(
        `INSERT INTO code_chunks (run_id, file_path, chunk_index, start_line, end_line, symbol_name, symbol_type, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          runId,
          file.path,
          chunk.chunkIndex,
          chunk.startLine,
          chunk.endLine,
          chunk.symbolName || null,
          chunk.symbolType || 'block',
          chunk.content,
          JSON.stringify(emb)
        ]
      );
    }
  }
}

/**
 * Code-Aware Hybrid Retrieval Pipeline:
 * Combines Vector Embedding Similarity + Keyword/Symbol Search + Deterministic File Weighting.
 */
export async function retrieveRelevantChunks(
  userQuery: string,
  runId: string,
  limit = 5,
  targetFilePath?: string
): Promise<CodeChunk[]> {
  try {
    await ensureRagTableExists();

    let sql = `SELECT id, run_id as "runId", file_path as "filePath", chunk_index as "chunkIndex", 
                     start_line as "startLine", end_line as "endLine", symbol_name as "symbolName",
                     symbol_type as "symbolType", content, embedding 
              FROM code_chunks WHERE run_id = $1`;
    const params: any[] = [runId];

    if (targetFilePath) {
      sql += ` AND (file_path = $2 OR file_path LIKE '%' || $2)`;
      params.push(targetFilePath);
    }

    const result = await query(sql, params);
    if (result.rows.length === 0) return [];

    const queryEmbedding = await embeddingService.embed(userQuery);
    const queryTerms = userQuery.toLowerCase().split(/\W+/).filter(t => t.length > 2);

    const scoredChunks: CodeChunk[] = result.rows.map(row => {
      const chunkEmbedding: number[] = typeof row.embedding === 'string' 
        ? JSON.parse(row.embedding) 
        : (row.embedding || []);

      // 1. Vector Semantic Cosine Similarity [0..1]
      const vectorSim = cosineSimilarity(queryEmbedding, chunkEmbedding);

      // 2. Keyword & Symbol Match Score
      let lexicalScore = 0;
      const contentLower = row.content.toLowerCase();
      const pathLower = row.filePath.toLowerCase();
      const symbolNameLower = (row.symbolName || '').toLowerCase();

      for (const term of queryTerms) {
        if (pathLower.includes(term)) lexicalScore += 12;
        if (symbolNameLower.includes(term)) lexicalScore += 18;
        const count = (contentLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        lexicalScore += count * 3;
      }

      // Hybrid combination score
      const hybridScore = (vectorSim * 40) + lexicalScore;

      return {
        id: row.id,
        runId: row.runId,
        filePath: row.filePath,
        chunkIndex: row.chunkIndex,
        startLine: row.startLine,
        endLine: row.endLine,
        symbolName: row.symbolName,
        symbolType: row.symbolType,
        content: row.content,
        score: parseFloat(hybridScore.toFixed(3))
      };
    });

    scoredChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Return top K chunks
    const nonZero = scoredChunks.filter(c => (c.score || 0) > 0);
    return nonZero.length > 0 ? nonZero.slice(0, limit) : scoredChunks.slice(0, limit);

  } catch (err) {
    console.error('Error in retrieveRelevantChunks RAG engine:', err);
    return [];
  }
}

/**
 * Formats RAG code chunks for insertion into LLM reasoning prompt.
 */
export function formatRagContext(chunks: CodeChunk[]): string {
  if (!chunks || chunks.length === 0) return 'No relevant source code snippets retrieved for this scope.';

  return chunks.map((c, i) => {
    const symbolInfo = c.symbolName ? ` [Symbol: ${c.symbolType} ${c.symbolName}]` : '';
    return `--- Code Snippet #${i + 1} [File: ${c.filePath} (Lines ${c.startLine}-${c.endLine})${symbolInfo}] ---\n\`\`\`\n${c.content}\n\`\`\``;
  }).join('\n\n');
}
