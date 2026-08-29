// Regression test for safe JSON parsing logic
// Ensures that non-JSON responses (like "An error occurred" text or HTML)
// are handled gracefully instead of crashing with JSON parsing errors.

function safeParseResponseText(text) {
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { error: text || 'An error occurred on the server.' };
  }
  return result;
}

function runTests() {
  console.log('Running safe JSON parsing regression tests...\n');

  const testCases = [
    {
      name: 'Valid JSON payload',
      input: '{"success": true, "data": {"id": "123"}}',
      expected: { success: true, data: { id: '123' } }
    },
    {
      name: 'Plain text error response ("An error occurred")',
      input: 'An error occurred on the server.',
      expected: { error: 'An error occurred on the server.' }
    },
    {
      name: 'HTML error response',
      input: '<html><body><h1>502 Bad Gateway</h1></body></html>',
      expected: { error: '<html><body><h1>502 Bad Gateway</h1></body></html>' }
    },
    {
      name: 'Empty response',
      input: '',
      expected: { error: 'An error occurred on the server.' }
    },
    {
      name: 'Valid JSON array',
      input: '[1, 2, 3]',
      expected: [1, 2, 3]
    }
  ];

  let failures = 0;

  testCases.forEach((tc, idx) => {
    const res = safeParseResponseText(tc.input);
    const isMatch = JSON.stringify(res) === JSON.stringify(tc.expected);
    if (isMatch) {
      console.log(`✅ Test Case ${idx + 1} Passed: ${tc.name}`);
    } else {
      console.error(`❌ Test Case ${idx + 1} Failed: ${tc.name}`);
      console.error(`   Expected:`, tc.expected);
      console.error(`   Got:     `, res);
      failures++;
    }
  });

  console.log('\n---------------------------------');
  if (failures === 0) {
    console.log('🎉 All safe JSON parsing regression tests passed successfully!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failures} test case failures occurred.`);
    process.exit(1);
  }
}

runTests();
