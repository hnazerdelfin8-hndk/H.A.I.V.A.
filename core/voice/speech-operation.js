// =========================================
 // H.A.I.V.A. VOICE — CANCELLABLE SPEECH OPERATION
 // =========================================
 
 /**
  * Owns one logical TTS operation.
  * Cancellation is terminal for the operation and never allows an older
  * completion to advance the VoiceInteraction lifecycle.
  */
 export class SpeechOperation {
   constructor({ speakFn, cancelFn } = {}) {
     this.speakFn = typeof speakFn === "function" ? speakFn : null;
     this.cancelFn = typeof cancelFn === "function" ? cancelFn : null;
     this.generation = 0;
     this.active = null;
   }
 
   start(text, turn = null) {
     this.cancel();
     const generation = ++this.generation;
 
     if (!this.speakFn) return Promise.resolve({ generation, turn, cancelled: false });
 
     let settled = false;
     let resolveOperation;
     const promise = new Promise(resolve => { resolveOperation = resolve; });
     const operation = { generation, turn, resolve: resolveOperation };
     this.active = operation;
 
     Promise.resolve()
       .then(() => this.speakFn(text))
       .then(() => {
         if (settled || this.active !== operation || generation !== this.generation) return;
         settled = true;
         this.active = null;
         resolveOperation({ generation, turn, cancelled: false });
       })
       .catch(() => {
         if (settled || this.active !== operation || generation !== this.generation) return;
         settled = true;
         this.active = null;
         resolveOperation({ generation, turn, cancelled: false, error: true });
       });
 
     return promise;
   }
 
   cancel(turn = null) {
     const operation = this.active;
     if (!operation) {
       this.generation += 1;
       return false;
     }
     if (turn != null && operation.turn != null && Number(turn) !== Number(operation.turn)) return false;
 
     this.generation += 1;
     this.active = null;
     try { this.cancelFn?.(); } catch (_) {}
     operation.resolve({ generation: operation.generation, turn: operation.turn, cancelled: true });
     return true;
   }
 
   isActive(turn = null) {
     return !!this.active && (turn == null || Number(turn) === Number(this.active.turn));
   }
 
   currentGeneration() {
     return this.generation;
   }
 }
