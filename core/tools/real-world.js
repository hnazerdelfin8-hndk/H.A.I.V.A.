const clone = value => structuredClone(value);

export function createExternalToolRegistry(initial = []) {
  const tools = new Map(initial.map(tool => [tool.id, { ...tool, scopes: [...(tool.scopes ?? [])] }]));
  return {
    register(tool) { if (!tool?.id || typeof tool.execute !== "function") throw new Error("Tool id and execute function are required."); tools.set(tool.id, { ...tool, scopes: [...(tool.scopes ?? [])] }); return clone({ ...tool, execute: undefined }); },
    list() { return clone([...tools.values()].map(({ execute, ...tool }) => tool)); },
    get(id) { return tools.get(id) ?? null; },
    async run(id, input, authorization = {}) { const tool = tools.get(id); if (!tool) throw new Error("Unknown external tool."); authorizeAction(tool, authorization); return tool.execute(input); }
  };
}

export function authorizeAction(tool, authorization = {}) {
  if (tool.risk === "high" && authorization.approved !== true) throw new Error("Human approval required for high-risk external action.");
  const required = tool.scope ?? tool.id; if (tool.scopes?.length && !tool.scopes.includes(required)) throw new Error("Requested tool scope is not allowed.");
  return true;
}

export function createWebResearchAdapter(fetchImpl = globalThis.fetch) {
  return async function research(url) { if (typeof fetchImpl !== "function") throw new Error("Fetch implementation is required."); const response = await fetchImpl(url); return { url, status: response.status, ok: response.ok, text: await response.text() }; };
}

export function createFileDocumentAdapter(fs) {
  if (!fs?.readFile || !fs?.writeFile) throw new Error("File adapter requires readFile and writeFile.");
  return { read: (file, encoding = "utf8") => fs.readFile(file, encoding), write: (file, data, encoding = "utf8") => fs.writeFile(file, data, encoding) };
}

export function createProductivityQueue() {
  const tasks = [];
  return { add(task) { if (!task?.id) throw new Error("Task id is required."); tasks.push(clone(task)); return clone(task); }, next() { return clone(tasks.shift() ?? null); }, snapshot() { return clone(tasks); } };
}

export function createBusinessWorkflow(steps = []) { return { steps: clone(steps), async run(input) { let value = input; for (const step of steps) value = await step(value); return value; } }; }
