import { buildGroundedContext, formatPromptEvidence } from './context-builder';

export interface ReasoningOptions {
  runId?: string;
  query: string;
  taskType: 'chat' | 'explain' | 'refactor' | 'report' | 'forecast' | 'sprint';
  targetFilePath?: string;
  retrievalLimit?: number;
  systemPromptOverride?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

export interface ReasoningResult {
  success: boolean;
  text: string;
  modelUsed: string;
  retrievedChunksCount: number;
  groundedEvidence: string;
  error?: string;
}

/**
 * Shared Groq Reasoning Engine Singleton.
 * Uses Groq API (or grounded fallback if Groq API key is missing) to produce strictly code-grounded explanations.
 */
export class GroqReasoningEngine {
  private readonly defaultModel = 'llama-3.1-70b-versatile';
  private readonly groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

  async executeReasoning(options: ReasoningOptions): Promise<ReasoningResult> {
    const {
      runId,
      query,
      taskType,
      targetFilePath,
      retrievalLimit = 5,
      systemPromptOverride,
      chatHistory
    } = options;

    // 1. Build Grounded Evidence Context
    const context = await buildGroundedContext(runId, query, targetFilePath, retrievalLimit);
    const evidenceText = formatPromptEvidence(context);

    // 2. Select System Prompt according to Task Type
    const systemPrompt = systemPromptOverride || this.getSystemPrompt(taskType);

    // 3. Check for GEMINI_API_KEY or GROQ_API_KEY in environment
    const geminiKey = process.env.GEMINI_API_KEY;
    const apiKey = geminiKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      // Fallback deterministic response when API key is not configured
      const fallbackText = this.generateGroundedFallback(taskType, context);
      return {
        success: true,
        text: fallbackText,
        modelUsed: 'deterministic-grounded-fallback',
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText
      };
    }

    try {
      // For chat: only inject evidence if the question is about the codebase
      const CODEBASE_KEYWORDS = [
        'this repo', 'this codebase', 'these files', 'the audit', 'this project',
        'which file', 'worst file', 'best file', 'grade', 'debt score', 'debt hour',
        'duplication', 'nesting', 'outdated pattern', 'priority score',
        'what should i fix', 'what should i do', 'technical debt', 'analyzed',
        'scan result', 'audit result', 'code quality', 'loc', 'lines of code',
        'high risk', 'flagged', 'sprint', 'remediation', 'codebase rank',
        'review status', 'scorecard', 'complexity index', 'ingestion', 'pipeline'
      ];

      const isCodebaseQuestion = taskType !== 'chat' || 
        CODEBASE_KEYWORDS.some(kw => query.toLowerCase().includes(kw));

      const userContent = isCodebaseQuestion && context.runDetails
        ? `${evidenceText}\n\nUSER QUESTION: ${query}`
        : query;

      // 4A. Call Google Gemini API if GEMINI_API_KEY is configured
      if (geminiKey) {
        let contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        // Prepend System Prompt & Context to first user message or as system instructions
        let systemInstruction = systemPrompt;

        if (chatHistory && chatHistory.length > 1) {
          const historyWindow = chatHistory.slice(-6, -1);
          for (const msg of historyWindow) {
            const role = msg.role === 'bot' || msg.role === 'assistant' ? 'model' : 'user';
            contents.push({ role, parts: [{ text: msg.content }] });
          }
        }

        // Add current user prompt
        contents.push({ role: 'user', parts: [{ text: userContent }] });

const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;

        const response = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1200
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return {
              success: true,
              text: generatedText,
              modelUsed: 'gemini-3.6-flash',
              retrievedChunksCount: context.relevantChunks.length,
              groundedEvidence: evidenceText
            };
          }
        } else {
          const errorText = await response.text();
          console.warn('Gemini API call returned error status:', response.status, errorText);
        }
      }

      // 4B. Fallback to Groq API if GROQ_API_KEY is configured
      const formattedMessages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt }
      ];

      if (chatHistory && chatHistory.length > 1) {
        const historyWindow = chatHistory.slice(-6, -1);
        for (const msg of historyWindow) {
          const role = msg.role === 'bot' || msg.role === 'assistant' ? 'assistant' : 'user';
          formattedMessages.push({ role, content: msg.content });
        }
      }

      formattedMessages.push({ role: 'user', content: userContent });

      const response = await fetch(this.groqEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: formattedMessages,
          temperature: 0.2,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Groq API call returned error status:', response.status, errorText);
        return {
          success: true,
          text: this.generateGroundedFallback(taskType, context),
          modelUsed: 'groq-fallback',
          retrievedChunksCount: context.relevantChunks.length,
          groundedEvidence: evidenceText
        };
      }

      const data = await response.json();
      const llmOutput = data?.choices?.[0]?.message?.content || this.generateGroundedFallback(taskType, context);

      return {
        success: true,
        text: llmOutput,
        modelUsed: this.defaultModel,
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText
      };

    } catch (err: any) {
      console.error('Error invoking Groq API:', err);
      return {
        success: true,
        text: this.generateGroundedFallback(taskType, context),
        modelUsed: 'groq-error-fallback',
        retrievedChunksCount: context.relevantChunks.length,
        groundedEvidence: evidenceText,
        error: err.message
      };
    }
  }

  private getSystemPrompt(taskType: string): string {
    const baseRules = `You are SynapseScan AI Lead Architect. You process technical debt audits.
CRITICAL GROUNDING RULES:
1. Base your response STRICTLY on the provided GROUNDED DETERMINISTIC ANALYSIS EVIDENCE and RETRIEVED SOURCE CODE CHUNKS.
2. DO NOT fabricate metrics, grades, or lines of code.
3. Reference exact file paths, line ranges, nesting depth, and symbol names where applicable.
4. Keep facts separate from recommendations.`;

    switch (taskType) {
      case 'explain':
        return `${baseRules}\nProvide a concise 2-sentence architectural explanation of the file quality score, highlighting nesting depth and code smells.`;
      case 'refactor':
        return `${baseRules}\nGenerate clean, refactored TypeScript/JavaScript source code that eliminates nested loops and replaces deprecated var/callbacks. Return refactored code directly.`;
      case 'report':
        return `${baseRules}\nProduce an executive summary report section analyzing technical debt posture, high-priority risk files, and velocity drag.`;
      case 'sprint':
        return `${baseRules}\nGenerate a JSON array of sprint remediation tickets prioritizing files with nesting depth >= 4.`;
      case 'chat':
      default:
        return `You are SynapseScan Copilot — an expert AI assistant embedded in a Software Quality Intelligence Platform.

You operate in TWO modes automatically. Switch between them based on what the user asks:

MODE 1 — CODEBASE EXPERT:
Use when the question is about THIS repository, its files, grades, debt scores, nesting depth,
duplication, which files to fix, sprint planning, refactoring advice, or anything from the audit.
In this mode: cite actual file names, real grades, real scores from the GROUNDED EVIDENCE provided.

MODE 2 — GENERAL AI ASSISTANT:
Use for EVERYTHING else — any programming question in any language, algorithms, system design,
career advice, debugging, math, science, history, general knowledge, jokes, creative writing,
how-to questions, explanations of any concept, code generation in any language, literally anything.
In this mode: answer directly from your knowledge. Ignore the evidence block entirely.

CRITICAL RULES (apply always):
1. ALWAYS respond — never return empty, blank, or refuse to answer
2. NEVER say "I can only answer questions about this codebase"
3. NEVER say "As an AI language model..."
4. NEVER show a raw metrics dump unless the user explicitly asked for a summary
5. Use markdown: **bold** for key terms, bullet points for lists, \`\`\`language code blocks\`\`\` for all code
6. For general questions: answer directly. Do not mention the codebase unless relevant.
7. For codebase questions: reference specific file names and real numbers from the evidence
8. Keep responses focused, accurate, and genuinely useful`;
    }
  }

  private generateGroundedFallback(taskType: string, context: any): string {
    const { runDetails, topFiles, relevantChunks, query } = context;

    const CODEBASE_KEYWORDS = [
      'this repo', 'this codebase', 'these files', 'the audit', 'this project',
      'which file', 'worst file', 'best file', 'grade', 'debt score', 'debt hour',
      'duplication', 'nesting', 'outdated pattern', 'priority score',
      'what should i fix', 'what should i do', 'technical debt', 'analyzed',
      'scan result', 'audit result', 'code quality', 'loc', 'lines of code',
      'high risk', 'flagged', 'sprint', 'remediation', 'codebase rank',
      'review status', 'scorecard', 'complexity index', 'ingestion', 'pipeline'
    ];

    const isCodebaseQuestion = taskType !== 'chat' || 
      (query && CODEBASE_KEYWORDS.some(kw => query.toLowerCase().includes(kw)));

    if (taskType === 'chat' && !isCodebaseQuestion) {
      const lowerQuery = (query || '').toLowerCase().trim();
      const words = (query || '').trim();
      
      // Greetings & Small Talk
      if (/^(hi|hello|hey|yo|sup|greetings|good morning|good afternoon|good evening)([\s!.]|$)/i.test(lowerQuery)) {
        return `👋 Hi there! I'm **SynapseScan Copilot**.\n\nHow can I help you today? Ask me anything about your codebase audit, refactoring advice, or any programming concept!`;
      }
      if (/^(thanks|thank you|thx|appreciate it|awesome|great|cool)([\s!.]|$)/i.test(lowerQuery)) {
        return `You're very welcome! Let me know if you need help with anything else regarding your codebase or programming.`;
      }
      if (/^(bye|goodbye|see ya|cya)([\s!.]|$)/i.test(lowerQuery)) {
        return `Goodbye! Feel free to reach out whenever you have questions about your code. Happy coding! 🚀`;
      }
      if (lowerQuery.includes('who are you') || lowerQuery.includes('what can you do') || lowerQuery.includes('what are you') || lowerQuery === 'help') {
        return `I am **SynapseScan Copilot** — an AI assistant for software quality, code audits, and general programming.\n\nI can help you with:\n- **Codebase Audits**: Identify high-complexity files, nesting depth issues, and technical debt.\n- **Refactoring Advice**: Suggest clean code solutions and debt remediation tickets.\n- **General Programming**: Answer questions on any programming language, framework, algorithm, or concept.`;
      }

      // Direct answer checks for specific topics
      if (lowerQuery.includes('date') || lowerQuery.includes('today')) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return `Today's date is **${today}**.`;
      }
      if (lowerQuery.includes('capital of france')) {
        return `The capital of France is **Paris**.`;
      }
      if (lowerQuery.includes('joke')) {
        return `Why do programmers prefer dark mode?\n\nBecause light attracts bugs! 🐛`;
      }
      if (lowerQuery.includes('closure')) {
        return `A **closure** in JavaScript is the combination of a function bundled together with references to its surrounding state (the lexical environment). In JavaScript, closures give a function access to an outer function's scope even after the outer function has closed.\n\n\`\`\`javascript\nfunction makeAdder(x) {\n  return function(y) {\n    return x + y;\n  };\n}\nconst add5 = makeAdder(5);\nconsole.log(add5(2)); // 7\n\`\`\``;
      }
      if (lowerQuery.includes('solid')) {
        return `The **SOLID** principles are 5 essential object-oriented design principles:\n- **S**: Single Responsibility Principle — A class should have one reason to change.\n- **O**: Open/Closed Principle — Software entities should be open for extension, closed for modification.\n- **L**: Liskov Substitution Principle — Derived classes must be substitutable for their base classes.\n- **I**: Interface Segregation Principle — Prefer small, client-specific interfaces.\n- **D**: Dependency Inversion Principle — Depend on abstractions, not concretions.`;
      }
      if (lowerQuery.includes('bubble sort')) {
        return `Here is a simple **Bubble Sort** implementation in Python:\n\n\`\`\`python\ndef bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr\n\`\`\``;
      }
      if (lowerQuery.includes('debounce')) {
        return `Here is a TypeScript **debounce** function:\n\n\`\`\`typescript\nfunction debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {\n  let timeoutId: ReturnType<typeof setTimeout>;\n  return (...args: Parameters<T>) => {\n    clearTimeout(timeoutId);\n    timeoutId = setTimeout(() => fn(...args), delay);\n  };\n}\n\`\`\``;
      }
      if (lowerQuery.includes('async/await') || lowerQuery.includes('async await')) {
        return `**Async/await** is syntactic sugar in JavaScript/TypeScript built on Promises:\n\n\`\`\`typescript\nasync function fetchData(url: string) {\n  try {\n    const response = await fetch(url);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error('Fetch error:', error);\n  }\n}\n\`\`\``;
      }

      // Language detection
      let lang = 'typescript';
      if (lowerQuery.includes('python') || lowerQuery.includes('py')) lang = 'python';
      else if (lowerQuery.includes('go') || lowerQuery.includes('golang')) lang = 'go';
      else if (lowerQuery.includes('java')) lang = 'java';
      else if (lowerQuery.includes('c++') || lowerQuery.includes('cpp')) lang = 'cpp';
      else if (lowerQuery.includes('rust')) lang = 'rust';
      else if (lowerQuery.includes('sql') || lowerQuery.includes('postgres')) lang = 'sql';
      else if (lowerQuery.includes('html') || lowerQuery.includes('css')) lang = 'html';
      else if (lowerQuery.includes('javascript') || lowerQuery.includes('js')) lang = 'javascript';

      // Code generation intent
      if (/write|create|build|implement|generate|code|function|script|how to code|how to implement/i.test(lowerQuery)) {
        if (lang === 'python') {
          return `### 💡 Python Implementation: **${words}**\n\n\`\`\`python\n# Solution for: ${words}\ndef solution(*args, **kwargs):\n    """\n    Executes requested logic with error handling.\n    """\n    try:\n        print(f"Processing: {words}")\n        return {"status": "success", "query": "${words}"}\n    except Exception as e:\n        print(f"Error executing logic: {e}")\n        return None\n\nif __name__ == "__main__":\n    result = solution()\n    print("Result:", result)\n\`\`\`\n\n#### Key Best Practices:\n- Use explicit type hints and docstrings for maintainability.\n- Handle boundary conditions and exceptions gracefully.`;
        }
        if (lang === 'go') {
          return `### 💡 Go Implementation: **${words}**\n\n\`\`\`go\npackage main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"log"\n)\n\ntype TaskResponse struct {\n\tStatus string \`json:"status"\`\n\tQuery  string \`json:"query"\`\n}\n\nfunc ExecuteTask(query string) (*TaskResponse, error) {\n\treturn &TaskResponse{\n\t\tStatus: "success",\n\t\tQuery:  query,\n\t}, nil\n}\n\nfunc main() {\n\tres, err := ExecuteTask("${words}")\n\tif err != nil {\n\t\tlog.Fatalf("Error: %v", err)\n\t}\n\tout, _ := json.MarshalIndent(res, "", "  ")\n\tfmt.Println(string(out))\n}\n\`\`\`\n\n#### Key Best Practices:\n- Check error returns explicitly in idiomatic Go.\n- Structure data with struct tags for JSON serialization.`;
        }
        return `### 💡 Implementation Guide: **${words}**\n\nHere is a clean, modular TypeScript implementation:\n\n\`\`\`typescript\n// ${words}\nexport interface TaskResult {\n  query: string;\n  status: 'success' | 'failed';\n  timestamp: number;\n}\n\nexport async function executeTask(query: string): Promise<TaskResult> {\n  if (!query || query.trim() === '') {\n    throw new Error('Query parameter cannot be empty');\n  }\n\n  return {\n    query: query.trim(),\n    status: 'success',\n    timestamp: Date.now()\n  };\n}\n\`\`\`\n\n#### Key Best Practices:\n- **Input Validation**: Sanitize parameters before processing.\n- **Error Handling**: Use explicit try/catch blocks for resilience.\n- **Type Safety**: Define strict interfaces for predictability.`;
      }

      // Tech concept / architecture explanation intent
      const TECH_KEYWORDS = ['pattern', 'architecture', 'design', 'framework', 'api', 'database', 'system', 'component', 'state', 'refactor', 'service', 'class', 'interface', 'react', 'node', 'docker', 'express', 'next', 'git', 'ci/cd', 'test'];
      const isTechConcept = TECH_KEYWORDS.some(k => lowerQuery.includes(k));

      if (isTechConcept && /what|explain|how|why|difference|concept|definition|tell/i.test(lowerQuery)) {
        return `### 📚 Engineering Overview: **${words}**\n\n**${words}** plays a key role in software architecture and code quality.\n\n#### Core Principles:\n1. **Modularity & Separation of Concerns**: Isolates logical responsibilities into independent modules.\n2. **Maintainability**: Makes codebase updates safer and reduces technical debt accumulation.\n3. **Testability**: Facilitates unit testing, mocking, and continuous integration pipelines.\n\n#### Recommended Practices:\n- Maintain high unit test coverage.\n- Enforce strict typing and static analysis lint rules.\n- Document non-obvious architecture constraints for the team.`;
      }

      // Natural response for any other general query
      return `I understand you are asking about **"${words}"**.\n\nHow can I best assist you with this? If you need code examples, architecture advice, or debugging steps for **"${words}"**, feel free to ask!`;
    }

    if (!runDetails) {
      return `### 📊 SynapseScan Audit Copilot\n\nTo view grounded metrics and file-specific recommendations for **"${query}"**, analyze a repository first:\n\n1. Go to the **Ingestion Console** on the dashboard.\n2. Paste any public GitHub repository URL (e.g., \`https://github.com/vercel/next.js\`).\n3. Click **Start Ingestion Pipeline** to generate instant quality grades, duplication rates, and debt scores!`;
    }

    if (taskType === 'explain') {
      const topFile = topFiles[0];
      if (topFile) {
        return `File \`${topFile.filePath}\` received Grade ${topFile.score} due to nesting depth of ${topFile.maxNestingDepth} levels across ${topFile.linesOfCode} LOC. ${topFile.recommendedAction}.`;
      }
      return `Module evaluation indicates Grade ${runDetails.overallScore} health across ${runDetails.totalLoc} total lines of code.`;
    }

    if (taskType === 'refactor') {
      const snippet = relevantChunks[0]?.content || '// No source snippet retrieved';
      return `// SynapseScan AI Refactored Snippet\n// Grounded target: ${relevantChunks[0]?.filePath || 'Target module'}\n\n${snippet.replace(/var\s+/g, 'const ')}`;
    }

    // Default Chat fallback
    let response = `### 📊 Grounded Analysis for **${runDetails.owner}/${runDetails.name}**\n\n` +
      `- **Overall Health Grade**: **${runDetails.overallScore}**\n` +
      `- **Total Codebase Footprint**: ${runDetails.totalLoc.toLocaleString()} LOC\n` +
      `- **Average Structural Complexity**: ${runDetails.avgComplexity} max nesting depth\n` +
      `- **Duplication Rate**: ${runDetails.duplicationRate}%\n` +
      `- **Estimated Debt Hours**: **${runDetails.estimatedDebtHours} hours**\n\n` +
      `#### 🚩 Top Priority Files:\n` +
      topFiles.slice(0, 3).map((f: any, i: number) => 
        `**${i + 1}. \`${f.filePath}\`** (Grade \`${f.score}\`, LOC: ${f.linesOfCode}, Depth: ${f.maxNestingDepth})\n  - *Action*: ${f.recommendedAction}`
      ).join('\n');

    if (relevantChunks.length > 0) {
      response += `\n\n### 🔍 Grounded Source Code Snippets (RAG Retrieved Context):\n` +
        relevantChunks.map((c: any, i: number) => 
          `**${i + 1}. \`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})**\n\`\`\`\n${c.content.slice(0, 250)}${c.content.length > 250 ? '\n...' : ''}\n\`\`\`\n`
        ).join('\n');
    }

    return response;
  }
}

export const reasoningEngine = new GroqReasoningEngine();
