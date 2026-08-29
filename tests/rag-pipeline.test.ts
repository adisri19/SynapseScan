import { chunkCodeFile } from '../lib/chunker';
import { 
  evaluateChunkWithRAG, 
  reduceChunkEvaluationsToFileGrade, 
  reduceFileResultsToRepositoryScore 
} from '../lib/analyzer';

async function runPipelineTest() {
  console.log('--- Testing AST-Based Chunker ---');
  const pythonSample = `
class DataProcessor:
    def __init__(self, name):
        self.name = name

    def process(self, items):
        results = []
        for item in items:
            if item > 0:
                results.append(item * 2)
        return results
`;

  const pyChunks = chunkCodeFile('processor.py', pythonSample);
  console.log(`Extracted ${pyChunks.length} chunks from Python file.`);
  console.assert(pyChunks.length > 0, 'Python chunking failed');

  console.log('\n--- Testing Map Phase (Chunk Evaluation) ---');
  const evalResult = await evaluateChunkWithRAG(pyChunks[0]);
  console.log('Chunk Map Evaluation Result:', evalResult);
  console.assert(evalResult.maintainabilityScore >= 1 && evalResult.maintainabilityScore <= 100, 'Score range invalid');

  console.log('\n--- Testing Reduce Phase (File & Repo Rollup) ---');
  const fileResult = reduceChunkEvaluationsToFileGrade('processor.py', [evalResult], pythonSample);
  console.log('File Analysis Result:', fileResult);

  const repoResult = reduceFileResultsToRepositoryScore([fileResult], 5.5);
  console.log('Overall Repository Scorecard:', {
    grade: repoResult.overallGrade,
    loc: repoResult.totalLoc,
    categories: repoResult.debtCategories
  });

  console.log('\n🎉 Pipeline test completed successfully!');
}

runPipelineTest().catch(console.error);
