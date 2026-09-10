// H.A.I.V.A. boot success boundary.
// Runtime READY is intentionally separate from boot completion.
const EVENT_NAME = "haiva:boot-ready";

export function confirmCoreBootReady(detail = {}) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}
