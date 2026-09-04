package com.haiva.assistant.bridge;

import com.haiva.assistant.body.HaivaBody;

/** Android-to-Core boundary. Local Body processing is the default path; a remote adapter may be added without changing UI/voice code. */
public final class CoreBridge {
    private final HaivaBody body;

    public CoreBridge(HaivaBody body) { this.body = body; }

    public String dispatch(String command) { return body.process(command); }
    public boolean isLocal() { return true; }
}
