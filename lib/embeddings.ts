import crypto from 'crypto';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimension(): number;
}

/**
 * Deterministic TF-IDF / Code-Hash Vector Embedding Provider.
 * Generates lightweight 64-dimensional feature embeddings for code chunks locally in sub-millisecond time.
 * Fully compatible with zero external API dependencies or rate limits, while supporting external provider swap-in.
 */
export class CodeFeatureEmbeddingProvider implements EmbeddingProvider {
  private readonly dimension = 64;

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    return this.computeVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.computeVector(t));
  }

  private computeVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    if (!text || text.trim().length === 0) return vector;

    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9_$]+/)
      .filter(t => t.length > 1);

    if (tokens.length === 0) return vector;

    for (const token of tokens) {
      // Deterministic hash to map token to index [0..63]
      const hash = crypto.createHash('md5').update(token).digest();
      const index = hash[0] % this.dimension;
      const weight = Math.log(1 + (token.length > 3 ? 2 : 1));
      vector[index] += weight;
    }

    // L2 Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = parseFloat((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }
}

// Global Singleton Embedding Service
export const embeddingService: EmbeddingProvider = new CodeFeatureEmbeddingProvider();

/**
 * Calculates Cosine Similarity between two embedding vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
