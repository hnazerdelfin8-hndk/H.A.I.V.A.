// =========================================
// H.A.I.V.A. — VERIFICATION ENGINE
// =========================================

/**
 * Normalize verifier output into an evidence-based verification result.
 */
export function verifyResult(result, criteria = {}) {
  const checks = Array.isArray(criteria.checks) ? criteria.checks : [];
  const failures = [];

  for (const check of checks) {
    if (typeof check === "function") {
      let passed = false;
      try {
        passed = Boolean(check(result));
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
        continue;
      }
      if (!passed) failures.push("Verification check failed.");
    } else if (check && typeof check === "object" && typeof check.test === "function") {
      try {
        if (!check.test(result)) failures.push(String(check.message || "Verification check failed."));
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const passed = failures.length === 0 && criteria.required !== true ||
    (failures.length === 0 && criteria.required === true && checks.length > 0);

  return {
    passed,
    evidence: {
      checked: checks.length,
      failures
    },
    result
  };
}

/**
 * Run an async verifier and normalize its result.
 */
export async function runVerification(verifier, target, criteria = {}) {
  if (typeof verifier !== "function") throw new Error("Verifier function is required.");

  try {
    const raw = await verifier(target, criteria);
    if (typeof raw === "boolean") {
      return { passed: raw, evidence: { source: "verifier" }, result: target };
    }
    if (raw && typeof raw === "object" && "passed" in raw) {
      return {
        passed: raw.passed === true,
        evidence: raw.evidence || { source: "verifier" },
        result: raw.result ?? raw
      };
    }
    return { passed: true, evidence: { source: "verifier", detail: raw }, result: raw };
  } catch (error) {
    return {
      passed: false,
      evidence: { source: "verifier", error: error instanceof Error ? error.message : String(error) },
      result: null
    };
  }
}
