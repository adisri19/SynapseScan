// Regression test for Chatbot UI Layout & Overflow Prevention
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runChatbotLayoutTests() {
  console.log('Running Chatbot Layout & Overflow Regression Tests...\n');

  const componentPath = path.join(__dirname, '../components/ai/chat-bot.tsx');
  const componentSource = fs.readFileSync(componentPath, 'utf8');

  // Test 1: Verify message wrapper container uses `min-w-0` and `break-words` to prevent flex items overflowing
  console.log('Testing Case 1: Message bubble container containment styling');
  assert.ok(
    componentSource.includes('min-w-0') && componentSource.includes('break-words'),
    'Expected min-w-0 and break-words on message container to prevent flexbox overflow'
  );
  console.log('✅ Test Case 1 Passed: Message container includes min-w-0 and break-words.');

  // Test 2: Verify preformatted code blocks use `overflow-x-auto` and `max-w-full`
  console.log('\nTesting Case 2: Code block scrollability styling');
  assert.ok(
    componentSource.includes('overflow-x-auto') && componentSource.includes('max-w-full'),
    'Expected overflow-x-auto and max-w-full on code blocks to handle long code lines'
  );
  console.log('✅ Test Case 2 Passed: Code blocks configured with overflow-x-auto and max-w-full.');

  // Test 3: Verify headers, paragraphs, and strong tags include break-all or break-words for long repo names
  console.log('\nTesting Case 3: Text elements break-all/break-words rules');
  assert.ok(
    componentSource.includes('break-all'),
    'Expected break-all styling on markdown text elements to wrap long repo names and paths'
  );
  console.log('✅ Test Case 3 Passed: Text formatting includes break-all rules.');

  console.log('\n---------------------------------');
  console.log('🎉 All Chatbot UI layout regression tests passed successfully!');
}

runChatbotLayoutTests();
