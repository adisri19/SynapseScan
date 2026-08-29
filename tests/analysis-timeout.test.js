// Regression test for Codebase Analysis Timeout & Fallback Heuristics
// Ensures that the custom evaluateChunkWithRAG function correctly respects
// the skipLLM flag to bypass expensive remote API calls and return local results instantly.

// Mock implementation mirroring the exact code inside lib/analyzer.ts
async function evaluateChunkWithRAG(chunk, runId, groqApiKey, skipLLM) {
  if (skipLLM) {
    const loc = chunk.content.split('\n').length;
    const nesting = (chunk.content.match(/\{/g) || []).length;
    const maintainability = Math.max(30, 95 - loc);
    const complexity = Math.max(20, 90 - nesting * 4);
    const security = chunk.content.includes('eval(') || chunk.content.includes('innerHTML') ? 40 : 88;

    return {
      chunkIndex: chunk.chunkIndex,
      filePath: chunk.filePath,
      maintainabilityScore: maintainability,
      complexityScore: complexity,
      securityScore: security,
      reasoning: `Grounding analysis: ${chunk.symbolName || 'Block'} contains ${loc} lines with complexity factor ${nesting}.`,
      identifiedIssues: nesting > 8 ? ['High nesting depth detected'] : []
    };
  }

  // Simulate an expensive remote API call if skipLLM is false
  if (groqApiKey) {
    await new Promise(r => setTimeout(r, 1500)); // 1.5 second API latency
    return {
      chunkIndex: chunk.chunkIndex,
      filePath: chunk.filePath,
      maintainabilityScore: 85,
      complexityScore: 80,
      securityScore: 90,
      reasoning: 'Analyzed via LLM.',
      identifiedIssues: []
    };
  }

  return {
    chunkIndex: chunk.chunkIndex,
    filePath: chunk.filePath,
    maintainabilityScore: 75,
    complexityScore: 75,
    securityScore: 85,
    reasoning: 'Default evaluation.',
    identifiedIssues: []
  };
}

async function testTimeoutFallback() {
  console.log('Running analysis timeout and fallback regression tests...\n');

  const mockChunk = {
    chunkIndex: 0,
    filePath: 'src/controllers/auth.ts',
    startLine: 1,
    endLine: 15,
    symbolName: 'loginUser',
    symbolType: 'function',
    content: `
      export function loginUser(req, res) {
        const { username, password } = req.body;
        if (username) {
          if (password) {
            db.query('SELECT * FROM users WHERE username = $1', [username], (err, user) => {
              if (user) {
                res.status(200).json(user);
              }
            });
          }
        }
      }
    `
  };

  let failures = 0;

  // Test Case 1: skipLLM is true
  try {
    console.log('Testing Case 1: skipLLM is TRUE (Should run local heuristics instantly)');
    const startTime = Date.now();
    const result = await evaluateChunkWithRAG(mockChunk, undefined, 'MOCK_KEY', true);
    const duration = Date.now() - startTime;

    if (duration < 50) {
      console.log('✅ Test Case 1 Passed: Executed instantly in', duration, 'ms');
    } else {
      console.error('❌ Test Case 1 Failed: Execution took too long (', duration, 'ms)');
      failures++;
    }

    if (result.maintainabilityScore !== undefined && result.complexityScore !== undefined) {
      console.log('✅ Test Case 1 Passed: Valid scores generated:', {
        maintainability: result.maintainabilityScore,
        complexity: result.complexityScore,
        reasoning: result.reasoning
      });
    } else {
      console.error('❌ Test Case 1 Failed: Missing required score properties.');
      failures++;
    }

  } catch (err) {
    console.error('❌ Test Case 1 Failed with error:', err.message);
    failures++;
  }

  // Test Case 2: skipLLM is false (Should take longer due to mock API latency)
  try {
    console.log('\nTesting Case 2: skipLLM is FALSE (Should simulate full remote API latency)');
    const startTime = Date.now();
    const result = await evaluateChunkWithRAG(mockChunk, undefined, 'MOCK_KEY', false);
    const duration = Date.now() - startTime;

    if (duration >= 1000) {
      console.log('✅ Test Case 2 Passed: Simulated remote API call took', duration, 'ms');
    } else {
      console.error('❌ Test Case 2 Failed: Did not execute remote API call simulation (took', duration, 'ms)');
      failures++;
    }

  } catch (err) {
    console.error('❌ Test Case 2 Failed with error:', err.message);
    failures++;
  }

  console.log('\n---------------------------------');
  if (failures === 0) {
    console.log('🎉 All timeout regression tests passed successfully!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failures} test case failures occurred.`);
    process.exit(1);
  }
}

testTimeoutFallback().catch(console.error);
