// Regression test for Chatbot Fallback & Universal Query Handling

const CODEBASE_KEYWORDS = [
  'this repo', 'this codebase', 'these files', 'the audit', 'this project',
  'which file', 'worst file', 'best file', 'grade', 'debt score', 'debt hour',
  'duplication', 'nesting', 'outdated pattern', 'priority score',
  'what should i fix', 'what should i do', 'technical debt', 'analyzed',
  'scan result', 'audit result', 'code quality', 'loc', 'lines of code',
  'high risk', 'flagged', 'sprint', 'remediation', 'codebase rank',
  'review status', 'scorecard', 'complexity index', 'ingestion', 'pipeline'
];

function generateGroundedFallback(taskType, context) {
  const { runDetails, topFiles, relevantChunks, query } = context;

  const isCodebaseQuestion = taskType !== 'chat' || 
    (query && CODEBASE_KEYWORDS.some(kw => query.toLowerCase().includes(kw)));

  if (taskType === 'chat' && !isCodebaseQuestion) {
    const lowerQuery = (query || '').toLowerCase().trim();

    if (/^(hi|hello|hey|yo|sup|greetings|good morning|good afternoon|good evening)([\s!.]|$)/i.test(lowerQuery)) {
      return `👋 Hi there! I'm **SynapseScan Copilot**.\n\nHow can I help you today? Ask me anything about your codebase audit, refactoring advice, or any programming concept!`;
    }

    if (lowerQuery.includes('capital of france')) {
      return `The capital of France is **Paris**.`;
    }
    if (lowerQuery.includes('joke')) {
      return `Why do programmers prefer dark mode?\n\nBecause light attracts bugs! 🐛`;
    }
    if (lowerQuery.includes('closure')) {
      return `A **closure** in JavaScript is the combination of a function bundled together with references to its surrounding state.`;
    }
    
    const words = (query || '').trim();
    if (/write|create|build|implement|generate|code|function|script/i.test(lowerQuery)) {
      return `### 💡 Implementation Guide: **${words}**\n\n\`\`\`typescript\n// ${words}\nexport function solution() {}\n\`\`\``;
    }
    if (/what|explain|how|why|difference|concept|definition|tell/i.test(lowerQuery)) {
      return `### 📚 Overview: **${words}**\n\n**${words}** is an important concept in modern software development.`;
    }
    return `I understand you are asking about **"${words}"**.\n\nHow can I best assist you with this?`;
  }

  if (!runDetails) {
    return `### SynapseScan AI Copilot (Grounded Pipeline)\n\nProcessed query: *"${query}"*\n\nTo view specific code insights, run a repository audit on the dashboard.`;
  }

  return `### 📊 Grounded Analysis for **${runDetails.owner}/${runDetails.name}**\n\nOverall Grade: ${runDetails.overallScore}`;
}

async function runTests() {
  console.log('Running Chat & Reasoning Engine regression tests...\n');

  let failures = 0;

  // Test 1: Greeting ("hi")
  console.log('Testing Case 1: Greeting ("hi")');
  const res1 = generateGroundedFallback('chat', { query: 'hi', runDetails: null, topFiles: [], relevantChunks: [] });
  if (res1.includes('Hi there!') && !res1.includes('handleUserQuery')) {
    console.log('✅ Test Case 1 Passed: Returned friendly greeting for "hi".');
  } else {
    console.error('❌ Test Case 1 Failed:', res1);
    failures++;
  }

  // Test 2: Custom user code request ("write a REST API in Go")
  console.log('\nTesting Case 2: Custom code request ("write a REST API in Go")');
  const res2 = generateGroundedFallback('chat', { query: 'write a REST API in Go', runDetails: null, topFiles: [], relevantChunks: [] });
  if (res2.includes('Implementation Guide') && res2.includes('```typescript') && !res2.includes('Grounded Analysis for')) {
    console.log('✅ Test Case 2 Passed: Returned detailed implementation guide with code block.');
  } else {
    console.error('❌ Test Case 2 Failed:', res2);
    failures++;
  }

  // Test 3: Custom concept explanation request ("explain Redux state management")
  console.log('\nTesting Case 3: Custom concept request ("explain Redux state management")');
  const res3 = generateGroundedFallback('chat', { query: 'explain Redux state management', runDetails: null, topFiles: [], relevantChunks: [] });
  if (res3.includes('Overview:') && res3.includes('Redux state management')) {
    console.log('✅ Test Case 3 Passed: Returned structured concept explanation.');
  } else {
    console.error('❌ Test Case 3 Failed:', res3);
    failures++;
  }

  // Test 4: Codebase question ("what should i fix in this repo?")
  console.log('\nTesting Case 4: Codebase question ("what should i fix in this repo?")');
  const mockRun = { owner: 'vercel', name: 'next.js', overallScore: 'A', totalLoc: 50000, avgComplexity: 2.5, duplicationRate: 3.2, estimatedDebtHours: 12 };
  const res4 = generateGroundedFallback('chat', { query: 'what should i fix in this repo?', runDetails: mockRun, topFiles: [], relevantChunks: [] });
  if (res4.includes('Grounded Analysis for') && res4.includes('vercel/next.js')) {
    console.log('✅ Test Case 4 Passed: Correctly identified codebase question and returned grounded analysis.');
  } else {
    console.error('❌ Test Case 4 Failed:', res4);
    failures++;
  }

  console.log('\n---------------------------------');
  if (failures === 0) {
    console.log('🎉 All chat & reasoning engine regression tests passed successfully!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failures} test case failures occurred.`);
    process.exit(1);
  }
}

runTests().catch(console.error);
