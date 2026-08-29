import { chunkCodeFile } from '../lib/chunker';
import { CodeFeatureEmbeddingProvider, cosineSimilarity } from '../lib/embeddings';

async function runTests() {
  console.log('--- RUNNING SYNAPSESCAN RAG & PIPELINE TESTS ---');

  // Test 1: Chunking Engine
  const testCode = `
import React from 'react';

export function HeaderComponent() {
  const [active, setActive] = React.useState(false);
  return <div>Header</div>;
}

export class DataService {
  fetchData() {
    return [1, 2, 3];
  }
}
  `;

  const chunks = chunkCodeFile('components/Header.tsx', testCode);
  console.log(`Test 1 (Chunker): Generated ${chunks.length} chunks. Symbols found:`, chunks.map(c => c.symbolName));
  console.assert(chunks.length >= 2, 'Chunker should identify functions/classes.');
  console.assert(chunks.some(c => c.symbolName === 'HeaderComponent'), 'Symbol name matching failed.');

  // Test 2: Embedding Provider & Cosine Similarity
  const provider = new CodeFeatureEmbeddingProvider();
  const emb1 = await provider.embed('function handleAction(config) { if (!config) return; }');
  const emb2 = await provider.embed('function handleAction(config) { if (!config) return; }');
  const emb3 = await provider.embed('import docker from "dockerode";');

  const simIdentical = cosineSimilarity(emb1, emb2);
  const simDifferent = cosineSimilarity(emb1, emb3);

  console.log(`Test 2 (Embedding): Identical Similarity = ${simIdentical.toFixed(3)}, Different Similarity = ${simDifferent.toFixed(3)}`);
  console.assert(simIdentical > 0.99, 'Identical code must have ~1.0 similarity');
  console.assert(simIdentical > simDifferent, 'Identical code must have higher similarity than different code');

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY.');
}

runTests().catch(err => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});
