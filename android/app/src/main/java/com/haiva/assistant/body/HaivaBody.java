package com.haiva.assistant.body;

import com.haiva.assistant.ai.LocalAIEngine;
import com.haiva.assistant.memory.LocalMemory;
import com.haiva.assistant.tools.ToolManager;
import com.haiva.assistant.tts.TTSManager;

public final class HaivaBody {
    private final LocalAIEngine ai;
    private final LocalMemory memory;
    private final ToolManager tools;
    private final TTSManager tts;
    private final BodyErrorHandler errorHandler;
    private SystemState state = SystemState.BOOTING;

    public HaivaBody(LocalAIEngine ai, LocalMemory memory, ToolManager tools, TTSManager tts) {
        this(ai, memory, tools, tts, new BodyErrorHandler());
    }

    HaivaBody(LocalAIEngine ai, LocalMemory memory, ToolManager tools, TTSManager tts, BodyErrorHandler errorHandler) {
        this.ai = ai;
        this.memory = memory;
        this.tools = tools;
        this.tts = tts;
        this.errorHandler = errorHandler;
    }

    public synchronized void setState(SystemState next) { state = next; }
    public synchronized SystemState getState() { return state; }

    public synchronized void start() {
        if (state == SystemState.STOPPED || state == SystemState.BOOTING || state == SystemState.ERROR) state = SystemState.STANDBY;
    }

    public synchronized void pause() {
        if (state != SystemState.STOPPED) state = SystemState.STANDBY;
    }

    public synchronized void stop() { state = SystemState.STOPPED; }

    public String process(String command) {
        String input = command == null ? "" : command.trim();
        if (input.isEmpty()) return "I didn't hear a command, Master.";
        setState(SystemState.THINKING);
        try {
            memory.remember("user", input);
            String toolResult = tools.tryExecute(input);
            String response = toolResult != null ? toolResult : ai.respond(input, memory.recent(8));
            if (response == null || response.trim().isEmpty()) throw new IllegalStateException("Empty Body response");
            memory.remember("assistant", response);
            setState(SystemState.STANDBY);
            return response.trim();
        } catch (Exception error) {
            return errorHandler.handle(this, error);
        }
    }

    public LocalMemory memory() { return memory; }
    public TTSManager tts() { return tts; }
}
