// H.A.I.V.A. V1 capture controller
import { handoffToV1, releaseFromV1, registerVoiceCaptureOwner } from "./gateway.js";
const SpeechRecognitionCtor = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
let browserRecognizer = null;
let captureActive = false;
function emitResult(text) { const normalized=String(text??"").trim(); if(!normalized||typeof window==="undefined")return; window.dispatchEvent(new CustomEvent("haiva:v1-capture-result",{detail:{text:normalized,source:"v1"}})); }
function emitCaptureError(error){if(typeof window==="undefined")return;window.dispatchEvent(new CustomEvent("haiva:v1-capture-error",{detail:{source:"v1",error}}));}
function stopBrowserCapture(){if(!browserRecognizer)return;try{browserRecognizer.abort();}catch(_){} browserRecognizer=null;}
function startBrowserCapture(){if(!SpeechRecognitionCtor||browserRecognizer||!captureActive)return false;try{const recognition=new SpeechRecognitionCtor();recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=3;browserRecognizer=recognition;recognition.onresult=event=>{let finalText="";for(let i=event.resultIndex;i<event.results.length;i+=1){const result=event.results[i];if(result.isFinal)finalText+=result[0]?.transcript||"";}if(finalText.trim())emitResult(finalText);};recognition.onerror=error=>{browserRecognizer=null;captureActive=false;emitCaptureError(error?.error||"unknown");};recognition.onend=()=>{browserRecognizer=null;const wasActive=captureActive;captureActive=false;if(wasActive)emitCaptureError("capture-ended");};recognition.start();return true;}catch(error){browserRecognizer=null;captureActive=false;console.warn("[HAIVA] V1 browser capture unavailable:",error?.message||error);return false;}}
function stopUnderlyingCapture(){captureActive=false;if(typeof window!=="undefined"&&window.HaivaBridge?.stopVoiceCapture){try{window.HaivaBridge.stopVoiceCapture();}catch(_){}}stopBrowserCapture();}
registerVoiceCaptureOwner("v1",stopUnderlyingCapture);
function startCapture(){if(typeof window==="undefined")return;captureActive=true;handoffToV1(()=>{if(!captureActive)return;if(window.HaivaBridge?.startVoiceCapture){try{window.HaivaBridge.startVoiceCapture();return;}catch(error){console.warn("[HAIVA] V1 native capture start failed:",error?.message||error);}}startBrowserCapture();});}
function stopCapture(){return releaseFromV1(stopUnderlyingCapture);}
export const v1Capture=Object.freeze({startCapture,stopCapture});
