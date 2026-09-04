package com.haiva.assistant.body;

/** Owns the Body runtime lifecycle state without coupling it to an Activity. */
public final class BodyLifecycleController {
    public enum State { CREATED, ACTIVE, PAUSED, STOPPED }

    private State state = State.STOPPED;

    public synchronized void onCreate() { state = State.CREATED; }
    public synchronized void onStart() { state = State.ACTIVE; }
    public synchronized void onStop() { state = State.STOPPED; }
    public synchronized void onPause() {
        if (state == State.ACTIVE) state = State.PAUSED;
    }
    public synchronized State state() { return state; }
    public synchronized boolean isActive() { return state == State.ACTIVE; }
}
