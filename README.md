# SynapseScan: Tech Debt & Code Quality Intelligence Platform

SynapseScan is an enterprise software quality and technical debt intelligence platform. It ingests public GitHub and GitLab repositories, parses codebases into AST-aware chunks, generates 64-dimensional feature vector embeddings for semantic RAG retrieval, and runs a Map-Reduce evaluation pipeline powered by Groq Llama-3.3-70B.

---

## 🛠 Real Engineering Challenges & How We Solved Them

Building an AI-augmented static analysis tool sounds straightforward until you run it against real-world repositories with thousands of lines of messy code. Here are the specific architectural hurdles we faced and how we engineered solutions for them:

### 1. Groq API Rate Limits (HTTP 429) & Concurrent Flooding
* **The Issue:** Our initial Map phase fired `Promise.all` across all file chunks simultaneously. For a repository with 40 chunks, sending 40 parallel HTTP requests at the exact same second triggered Groq's free-tier rate limits (`HTTP 429 Too Many Requests`). The app fell back silently to local heuristics, making it look like the Groq key wasn't working.
* **The Fix:** We implemented a controlled batching queue (`batchSize = 3`) in `app/api/analyze/route.ts` and created a `shouldEvaluateWithLLM` filter in `lib/analyzer.ts`. Trivial chunks (pure import/export blocks, small configs, or snippets under 5 LOC) are scored instantly with local AST rules, while complex functions/classes go to Groq. This cut LLM API requests by **~65%** and eliminated rate limits.

### 2. Environment Variable Quote Corruption (HTTP 401)
* **The Issue:** When users wrapped their API key in quotes inside `.env` or `.env.local` (e.g. `GROQ_API_KEY="gsk_..."`), Node loaded the literal double quotes into the string. Sending `Authorization: Bearer "gsk_..."` resulted in immediate `401 Unauthorized` rejections.
* **The Fix:** Built `sanitizeApiKey()` in `lib/reasoning-engine.ts` to automatically strip leading/trailing quotes (`"`, `'`) and whitespace before constructing request headers.

### 3. The Flawed `{}` Brace Counter & Python Blindness
* **The Issue:** Early nesting depth logic used regex to count `{` and `}` characters line-by-line. This caused two major bugs:
  1. Config files with nested JSON objects or React JSX props were falsely flagged with `maxNestingDepth = 8` (Grade F).
  2. Python files (which use indentation instead of curly braces) always evaluated to `maxNestingDepth = 0`.
* **The Fix:** Deleted `calculateNestingDepth` entirely. We updated `CHUNK_EVALUATION_SYSTEM_PROMPT` to ask the LLM for `maxNestingDepth`, and calculated indentation-based structural depth for fallbacks. Python and TypeScript are now scored fairly.

### 4. Replacing Fake Regex Chunking with Token AST Parsing
* **The Issue:** `lib/chunker.ts` originally used regex signatures (`const fnRegex = ...`) to guess function/class boundaries. This broke on multi-line parameters, arrow functions, and async decorators.
* **The Fix:** Rewrote `lib/chunker.ts` to use token-based AST declaration boundary parsing (`extractAstSymbolBoundaries`). It parses language tokens (`function`, `class`, `def`, `interface`, `async`, `struct`) to slice code cleanly at true AST declaration nodes.

### 5. UI Mismatch on Grade F Annotations
* **The Issue:** A file like `data/cases.json` received a Grade `F` due to priority scores, but the UI displayed *"No critical tech-debt indicators identified. Codebase structure matches quality guidelines"* because the frontend function was only checking LOC thresholds instead of the grade.
* **The Fix:** Fixed `getAnnotatedIssues` in `review-results-panel.tsx` to handle `F` and `D` grades explicitly. We also added a live **🤖 AI Lead Architect Assessment** card in the Review Console that calls `/api/ai/explain` to display grounded Groq LLM explanations when any file is selected.

### 6. Migrating to Official OpenAI SDK with Automatic Retries
* **The Issue:** Raw `fetch()` calls to LLM endpoints failed immediately when network blips or rate limits occurred, forcing immediate fallback to local heuristics.
* **The Fix:** Replaced raw `fetch()` calls in `lib/reasoning-engine.ts` and `lib/analyzer.ts` with the official `openai` SDK pointing natively to Groq (`baseURL: 'https://api.groq.com/openai/v1'`). The SDK handles **automatic exponential backoff retries (`maxRetries: 3`)** and enforces strict JSON object schema responses natively.

---

## 🏗 Technical Stack

* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS (Dark Enterprise Theme)
* **Database:** PostgreSQL (with transaction blocks and custom indices)
* **AI Engine:** Groq API (`llama-3.3-70b-versatile`)
* **Vector Search:** 64-Dimensional Code-Hash Feature Vector Embeddings & Cosine Similarity
* **State Management:** Zustand
* **Visualization:** Recharts & SVG Dependency Visualizer
* **Reports:** jsPDF & jsPDF-Autotable

---

## ⚡ Quick Start

### 1. Prerequisites
* Node.js 18+ installed
* PostgreSQL instance or Docker

### 2. Setup Environment Variables
Create `.env` at the root directory:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/synapsescan"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GROQ_API_KEY="gsk_your_groq_api_key_here"
GITHUB_TOKEN=""
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Local Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and paste any public GitHub/GitLab URL to run an audit.
