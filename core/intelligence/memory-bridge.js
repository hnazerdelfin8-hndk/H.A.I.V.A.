export function createIntelligenceMemoryBridge(memory) {
  if (!memory || typeof memory.recall !== "function" || typeof memory.remember !== "function") throw new TypeError("Advanced memory store is required.");
  return {
    retrieve(query, limit = 10) { return memory.recall({ query, limit }); },
    rememberDecision(goal, decision, metadata = {}) { return memory.remember({ type: "decision", content: `${goal}: ${decision}`, metadata: { ...metadata, intelligence: true }, source: "reasoning" }); },
    rememberResult(goal, result, metadata = {}) { return memory.remember({ type: "summary", content: `${goal}: ${String(result)}`, metadata: { ...metadata, intelligence: true }, source: "reasoning" }); }
  };
}
