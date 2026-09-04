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
    private SystemState state = SystemState.BOOTING;

    public HaivaBody(LocalAIEngine ai, LocalMemory memory, ToolManager tools, TTSManager tts) {
        this.ai = ai;
        this.memory = memory;
        this.tools = tools;
        this.tts = tts;
    }

    public synchronized void setState(SystemState next) { state = next; }
    public synchronized SystemState getState() { return state; }

    public String process(String command) {
        String input = command == null ? "" : command.trim();
        if (input.isEmpty()) return "I didn't hear a command, Master.";
        setState(SystemState.THINKING);
        memory.remember("user", input);
        String toolResult = tools.tryExecute(input);
        String response = toolResult != null ? toolResult : ai.respond(input, memory.recent(8));
        memory.remember("assistant", response);
        return response;
    }

    public LocalMemory memory() { return memory; }
    public TTSManager tts() { return tts; }
}
