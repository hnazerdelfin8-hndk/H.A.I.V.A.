export class VoiceSessionManager {
  constructor() {
    this.sessionId = 0;
    this.active = false;
  }

  start() {
    this.sessionId += 1;
    this.active = true;
    return this.sessionId;
  }

  end() {
    this.active = false;
    return this.sessionId;
  }

  current() {
    return this.sessionId;
  }

  isActive(sessionId) {
    return this.active && Number(sessionId) === this.sessionId;
  }

  accept(event) {
    if (!this.active || !event) return false;
    if (event.sessionId != null && Number(event.sessionId) !== this.sessionId) return false;
    return true;
  }
}
