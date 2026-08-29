import { query } from './db';
import { retrieveRelevantChunks, formatRagContext } from './rag';
import { GroundedContext, FileMetric, DuplicationBlock } from './types';

/**
 * Builds structured evidence context combining:
 * 1. Deterministic DB Metrics (Overall grade, LOC, complexity, file scorecards)
 * 2. Code Duplications
 * 3. Retrieved RAG Source Code Chunks
 */
export async function buildGroundedContext(
  runId: string | undefined,
  userQuery: string,
  targetFilePath?: string,
  retrievalLimit = 5
): Promise<GroundedContext> {
  let runDetails = null;
  let topFiles: FileMetric[] = [];
  let duplications: DuplicationBlock[] = [];
  let relevantChunks: any[] = [];

  if (runId) {
    try {
      // 1. Fetch Repository & Analysis Run details
      const runQuery = await query(
        `SELECT r.owner, r.name, r.url, ar.overall_score, ar.total_loc, ar.avg_complexity, ar.duplication_rate, ar.debt_categories, ar.estimated_debt_hours 
         FROM analysis_runs ar
         JOIN repositories r ON ar.repository_id = r.id
         WHERE ar.id = $1`,
        [runId]
      );

      if (runQuery.rows.length > 0) {
        const row = runQuery.rows[0];
        const rawCategories = typeof row.debt_categories === 'string' 
          ? JSON.parse(row.debt_categories) 
          : row.debt_categories;

        runDetails = {
          owner: row.owner,
          name: row.name,
          url: row.url,
          overallScore: row.overall_score,
          totalLoc: Number(row.total_loc),
          avgComplexity: Number(row.avg_complexity),
          duplicationRate: Number(row.duplication_rate),
          estimatedDebtHours: Number(row.estimated_debt_hours),
          debtCategories: rawCategories || { security: 0, maintainability: 0, duplication: 0, coverage: 0 }
        };

        // 2. Fetch File Metrics (Filter by file path if targeted)
        let filesSql = `SELECT id, run_id as "runId", file_path as "filePath", lines_of_code as "linesOfCode",
                               max_nesting_depth as "maxNestingDepth", score, outdated_patterns_count as "outdatedPatternsCount",
                               priority_score as "priorityScore", review_status as "reviewStatus", recommended_action as "recommendedAction"
                        FROM file_metrics WHERE run_id = $1`;
        const filesParams: any[] = [runId];

        if (targetFilePath) {
          filesSql += ` AND (file_path = $2 OR file_path LIKE '%' || $2)`;
          filesParams.push(targetFilePath);
        } else {
          filesSql += ` ORDER BY priority_score DESC LIMIT 10`;
        }

        const filesResult = await query(filesSql, filesParams);
        topFiles = filesResult.rows;

        // 3. Fetch Duplications
        const dupsResult = await query(
          `SELECT block_hash as "blockHash", line_count as "lineCount", file_occurrences as "fileOccurrences"
           FROM duplications WHERE run_id = $1 LIMIT 5`,
          [runId]
        );
        duplications = dupsResult.rows;

        // 4. Retrieve RAG Source Code Chunks
        relevantChunks = await retrieveRelevantChunks(userQuery, runId, retrievalLimit, targetFilePath);
      }
    } catch (err) {
      console.warn('Warning: Error building grounded context from DB:', err);
    }
  }

  return {
    runDetails,
    topFiles,
    duplications,
    relevantChunks,
    query: userQuery
  };
}

/**
 * Formats GroundedContext into a structured prompt block for Groq LLM.
 */
export function formatPromptEvidence(context: GroundedContext): string {
  const { runDetails, topFiles, duplications, relevantChunks } = context;

  if (!runDetails) {
    return `[NO REPOSITORY RUN CONTEXT DETECTED]\nQuestion: "${context.query}"`;
  }

  const fileSummary = topFiles.map(f => 
    `- File: \`${f.filePath}\` | Grade: ${f.score} | LOC: ${f.linesOfCode} | Max Nesting Depth: ${f.maxNestingDepth} | Outdated Patterns: ${f.outdatedPatternsCount} | Action: ${f.recommendedAction}`
  ).join('\n');

  const ragCodeSnippets = formatRagContext(relevantChunks);

  return `
=== GROUNDED DETERMINISTIC ANALYSIS EVIDENCE ===
Repository: ${runDetails.owner}/${runDetails.name} (${runDetails.url})
Overall Code Grade: ${runDetails.overallScore}
Total LOC: ${runDetails.totalLoc}
Average Structural Nesting Depth: ${runDetails.avgComplexity}
Code Duplication Rate: ${runDetails.duplicationRate}%
Estimated Remediation Debt: ${runDetails.estimatedDebtHours} hours

--- TOP ANALYSIS FILE METRICS ---
${fileSummary || 'No matching file metrics found.'}

--- RETRIEVED SOURCE CODE CHUNKS (RAG EVIDENCE) ---
${ragCodeSnippets}
=================================================
`.trim();
}
