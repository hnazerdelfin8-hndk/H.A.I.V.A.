// =========================================
// H.A.I.V.A. — DIAGNOSTICS ENGINE
// =========================================

const FAILURE_PATTERNS = [
  { pattern: /approval required/i, category: "approval", recommendation: "Request or confirm the required approval before execution." },
  { pattern: /not registered/i, category: "missing_tool", recommendation: "Register the required tool or correct the tool name." },
  { pattern: /enoent|no such file|path.*not found/i, category: "missing_path", recommendation: "Inspect the referenced path and verify the file or directory exists." },
  { pattern: /timeout|timed out/i, category: "timeout", recommendation: "Retry with bounded attempts and inspect the dependency or operation duration." },
  { pattern: /econnrefused|network|fetch failed/i, category: "network", recommendation: "Check network availability and the target service before retrying." },
  { pattern: /syntaxerror|unexpected token/i, category: "syntax", recommendation: "Inspect the reported source location and correct the syntax before rerunning tests." },
  { pattern: /assertionerror|assertion failed|expected .* but/i, category: "test_failure", recommendation: "Compare expected and actual behavior, then fix the smallest responsible change." }
];

/**
 * Analyze an error and return structured diagnostic evidence.
 */
export function diagnoseFailure(error, context = {}) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown failure");
  const match = FAILURE_PATTERNS.find(item => item.pattern.test(message));

  return {
    status: "diagnosed",
    category: match?.category || "unknown",
    message,
    recommendation: match?.recommendation || "Inspect the failing operation, gather evidence, and avoid speculative changes.",
    retryable: Boolean(match && ["timeout", "network", "test_failure"].includes(match.category)),
    context
  };
}

/**
 * Execute a bounded recovery loop. The recovery callback must be supplied by
 * the caller so diagnostics never silently perform unsafe mutations.
 */
export async function recoverFromFailure(error, {
  context = {},
  maxAttempts = 1,
  recover = null
} = {}) {
  const diagnosis = diagnoseFailure(error, context);
  if (typeof recover !== "function" || !diagnosis.retryable || maxAttempts < 1) {
    return { recovered: false, attempts: 0, diagnosis };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await recover({ attempt, diagnosis, context });
      return { recovered: true, attempts: attempt, diagnosis, result };
    } catch (nextError) {
      if (attempt === maxAttempts) {
        return {
          recovered: false,
          attempts: attempt,
          diagnosis: diagnoseFailure(nextError, context)
        };
      }
    }
  }

  return { recovered: false, attempts: maxAttempts, diagnosis };
}
