const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/^"|"$/g, '');
        }
        process.env[key] = value.trim();
      }
    }
  }
} catch (e) {
  console.error('Error loading .env file:', e);
}

const { GroqReasoningEngine } = require('./lib/reasoning-engine');

async function test() {
  const engine = new GroqReasoningEngine();
  console.log('Testing executeReasoning directly...');
  console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
  const res = await engine.executeReasoning({
    query: 'explain why examples/mvc/controllers/user/index.js is Grade B',
    taskType: 'chat'
  });
  console.log('Result modelUsed:', res.modelUsed);
  console.log('Result text:\n', res.text);
  if (res.error) console.log('Result error:', res.error);
}

test();
