package com.haiva.assistant.bridge;

import com.haiva.assistant.body.HaivaBody;

/** Android-to-Core boundary. Keeps Body lifecycle and command dispatch synchronized. */
public final class CoreBridge {
    private final HaivaBody body;

    public CoreBridge(HaivaBody body) {
        if (body == null) throw new IllegalArgumentException("Body is required");
        this.body = body;
        body.start();
    }

    public String dispatch(String command) {
        body.start();
        return body.process(command);
    }

    public void pause() { body.pause(); }
    public void stop() { body.stop(); }
    public boolean isLocal() { return true; }
    public boolean isReady() { return body.getState() != com.haiva.assistant.body.SystemState.STOPPED; }
}
