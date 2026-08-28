# SynapseScan: Tech Debt & Code Quality Intelligence Platform

SynapseScan is a production-grade, multi-view software quality and technical debt intelligence platform. It ingests public GitHub and GitLab repositories, analyzes codebases for structural metrics, detects duplication blocks using sliding-window MD5 hashing, identifies outdated patterns, and persists analysis runs securely in PostgreSQL.

Designed with a high-density enterprise UI/UX, the platform features a persistent collapsible sidebar, visual KPI cards, interactive data plots, structured file reviews, and high-fidelity text-based PDF report generation.

---

## Technical Stack

*   **Framework:** Next.js 14 (App Router)
*   **Language:** TypeScript (Strict Typing)
*   **Styling:** Tailwind CSS (Dark-themed Enterprise Design)
*   **Database:** PostgreSQL (with transaction blocks and custom index optimizations)
*   **State Management:** Zustand
*   **Data Visualization:** Recharts (Scatter plots, Category Donuts, Composed historical trends)
*   **Report Generation:** jsPDF & jsPDF-Autotable

---

## Core Views

1.  **Overview Dashboard (`/dashboard`)**
    *   Four KPI modules with indicators and call-to-actions.
    *   Complexity Profile Scatter Plot charting Lines of Code vs. Nesting Depth.
    *   Donut Chart categorizing technical debt (Maintainability, Security, Duplication, Coverage).
    *   Composed historical trend timeline of previous pipeline audits.
2.  **File Review Console (`/review`)**
    *   Interactive filtering (Review Status, Severity levels, directory module paths, date ranges).
    *   Code search bar filtering individual file metrics.
    *   Remediation Inspector containing priority scores, custom actions, and localized warning annotations.
3.  **Ingestion Panel (`/ingestion`)**
    *   GitHub & GitLab repository link audit triggers.
    *   Accordion panel configuring AST parser options (nesting depth thresholds, size limits).
    *   Real-time vertical progress stepper animating clone, download, scoring, and saving pipelines.
4.  **Audit Runs & Logs Registry (`/logs`)**
    *   Complete historic timeline records table showing status, file counts, and trigger operators.
    *   Raw Terminal Log popup overlay simulating deep system runtime summaries.

---

## Database Architecture

Initialize your PostgreSQL database using the schema defined in `schema.sql`:

```sql
-- Core structural tables
tenants (id, name, slug, created_at)
repositories (id, tenant_id, url, owner, name, created_at, updated_at)
analysis_runs (id, tenant_id, repository_id, overall_score, total_loc, avg_complexity, duplication_rate, debt_categories, estimated_debt_hours, created_at)
file_metrics (id, run_id, file_path, lines_of_code, max_nesting_depth, score, outdated_patterns_count, priority_score, review_status, recommended_action)
duplications (id, run_id, block_hash, line_count, file_occurrences)
ingestion_sessions (id, tenant_id, repository_id, status, progress_step, progress_pct, triggered_by, created_at, completed_at)
webhook_configs (id, repo_url, secret_token, events, created_at)
```

---

## Getting Started

### Prerequisites

*   Node.js 18.x or later
*   PostgreSQL instance (e.g., Supabase or local Docker)

### Installation

1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```

2.  Configure environment variables in `.env.local` inside the root directory:
    ```env
    DATABASE_URL="postgresql://user:password@host:6543/postgres"
    GITHUB_TOKEN="your_optional_github_token_classic"
    GITLAB_TOKEN="your_optional_gitlab_private_token"
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
    ```
    *Note: If your database password contains special characters like `@`, make sure to percent-encode it as `%40` inside the connection string to avoid connection parsing errors.*

3.  Apply migrations using your PostgreSQL console or client to load `schema.sql`.

4.  Boot up the local development server:
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## CI/CD Webhook Setup

Automated code quality scans can be triggered asynchronously on push and pull-request events using SynapseScan's webhook engine:

1.  Navigate to **Ingestion Pipeline** -> **CI/CD Webhook** in the UI.
2.  Copy your unique, read-only endpoint URL (`http://<your-host>/api/webhook/analyze`).
3.  Fill in the repository context URL and generate a cryptographically secure **Secret Token**.
4.  Configure the webhook in your GitHub/GitLab repository settings under Webhooks. Use `application/json` as the content type, paste your secret token, and select push/PR trigger events.
5.  Save your configuration. SynapseScan will verify signatures cryptographically (`X-Hub-Signature-256`) and process analysis queues asynchronously.
