import assert from "node:assert/strict";
import { createMultimodalContext, understandImage, understandDocument, understandScreen, understandAudio, reasonAcrossModalities, createVoiceVisionRequest, verifyMultimodalResult } from "../../core/multimodal/index.js";

const context = createMultimodalContext([{ type: "image", data: "img" }, { type: "document", data: "pdf" }, { type: "screen", data: "ui" }, { type: "audio", data: "wav" }]);
assert.equal(context.inputs.length, 4); assert.deepEqual(context.modalities.sort(), ["audio", "document", "image", "screen"]);
assert.equal(understandImage({ data: "x" }).type, "image"); assert.equal(understandDocument({ data: "x" }).type, "document"); assert.equal(understandScreen({ data: "x" }).type, "screen"); assert.equal(understandAudio({ data: "x" }).type, "audio");
assert.equal(reasonAcrossModalities(context, value => value.inputs.length), 4);
assert.equal(createVoiceVisionRequest("voice", "screen").modalities.length, 2);
assert.equal(verifyMultimodalResult(context, ["image", "audio"]).passed, true);
assert.equal(verifyMultimodalResult(context, ["image", "video"]).passed, false);
console.log("PASS: Stage 9A-9H Multimodal H.A.I.V.A. verification");
