package com.haiva.assistant.plugins;

/** Minimal connector contract used by the Android plugin manager. */
public interface Plugin {
    String id();
    String name();
    String description();
    boolean isConnected();
    void connect();
    void disconnect();
}
