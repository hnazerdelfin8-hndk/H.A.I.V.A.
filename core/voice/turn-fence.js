export class VoiceTurnFence {
  constructor() {
    this.turn = 0;
    this.valid = false;
  }

  begin() {
    this.turn += 1;
    this.valid = true;
    return this.turn;
  }

  invalidate() {
    this.valid = false;
    return this.turn;
  }

  current() {
    return this.turn;
  }

  isCurrent(turn) {
    return this.valid && Number(turn) === this.turn;
  }

  accept(turn) {
    return this.isCurrent(turn);
  }
}
