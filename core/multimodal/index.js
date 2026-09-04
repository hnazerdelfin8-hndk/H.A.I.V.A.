const SUPPORTED = new Set(["image", "document", "screen", "audio", "text"]);
const clone = value => structuredClone(value);

export function normalizeInput(input) {
  if (!input?.type || !SUPPORTED.has(input.type)) throw new Error("Unsupported modality.");
  return { type: input.type, data: input.data, metadata: { ...(input.metadata ?? {}) } };
}

export function createMultimodalContext(inputs = []) { return { inputs: inputs.map(normalizeInput), modalities: [...new Set(inputs.map(input => input.type))] }; }

export function understandImage(input) { return normalizeInput({ ...input, type: "image" }); }
export function understandDocument(input) { return normalizeInput({ ...input, type: "document" }); }
export function understandScreen(input) { return normalizeInput({ ...input, type: "screen" }); }
export function understandAudio(input) { return normalizeInput({ ...input, type: "audio" }); }

export function reasonAcrossModalities(context, reasoner = value => value) { if (!context?.inputs) throw new Error("Multimodal context is required."); return reasoner(clone(context)); }

export function createVoiceVisionRequest(voice, visual) { return createMultimodalContext([{ type: "audio", data: voice }, { type: "screen", data: visual }]); }

export function verifyMultimodalResult(result, requiredModalities = []) { const actual = new Set(result?.modalities ?? result?.inputs?.map(input => input.type) ?? []); const missing = requiredModalities.filter(type => !actual.has(type)); return { passed: missing.length === 0, missing }; }
