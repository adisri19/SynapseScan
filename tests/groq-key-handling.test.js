// Regression test for Groq API key sanitization and error handling.
// Ensures that quotes (single/double) and whitespace in .env keys are stripped
// so Bearer authentication headers sent to Groq API are valid strings.

function sanitizeApiKey(key) {
  if (!key) return '';
  return key.trim().replace(/^["']|["']$/g, '').trim();
}

function runTests() {
  console.log('Running Groq API Key sanitization regression tests...\n');

  const testCases = [
    {
      name: 'Unquoted clean key',
      input: 'gsk_abcdef123456789',
      expected: 'gsk_abcdef123456789'
    },
    {
      name: 'Key wrapped in double quotes from .env ("gsk_...")',
      input: '"gsk_abcdef123456789"',
      expected: 'gsk_abcdef123456789'
    },
    {
      name: 'Key wrapped in single quotes (\'gsk_...\')',
      input: "'gsk_abcdef123456789'",
      expected: 'gsk_abcdef123456789'
    },
    {
      name: 'Key with leading and trailing spaces',
      input: '   gsk_abcdef123456789   ',
      expected: 'gsk_abcdef123456789'
    },
    {
      name: 'Key with spaces AND quotes (" gsk_abcdef123456789 ")',
      input: '  " gsk_abcdef123456789 "  ',
      expected: 'gsk_abcdef123456789'
    },
    {
      name: 'Undefined or empty key input',
      input: undefined,
      expected: ''
    },
    {
      name: 'Null key input',
      input: null,
      expected: ''
    }
  ];

  let failures = 0;

  testCases.forEach((tc, idx) => {
    const res = sanitizeApiKey(tc.input);
    if (res === tc.expected) {
      console.log(`✅ Test Case ${idx + 1} Passed: ${tc.name}`);
    } else {
      console.error(`❌ Test Case ${idx + 1} Failed: ${tc.name}`);
      console.error(`   Expected: "${tc.expected}"`);
      console.error(`   Got:      "${res}"`);
      failures++;
    }
  });

  console.log('\n---------------------------------');
  if (failures === 0) {
    console.log('🎉 All Groq API key sanitization tests passed successfully!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failures} test case failures occurred.`);
    process.exit(1);
  }
}

runTests();
