package com.haiva.assistant.ai;

import java.util.List;
import java.util.Locale;

/**
 * Offline-first AI boundary. The deterministic fallback is always available;
 * a native LLM runtime can later implement the same contract without changing the body.
 */
public final class LocalAIEngine {
    public interface ModelProvider {
        String generate(String prompt, List<String> context);
    }

    private ModelProvider provider;

    public void setModelProvider(ModelProvider provider) { this.provider = provider; }

    public boolean hasLocalModel() { return provider != null; }

    public String respond(String command, List<String> context) {
        if (provider != null) {
            try {
                String result = provider.generate(command, context);
                if (result != null && !result.trim().isEmpty()) return result.trim();
            } catch (Exception ignored) { }
        }
        return fallback(command);
    }

    private String fallback(String command) {
        String c = command.toLowerCase(Locale.US);
        if (c.contains("who are you") || c.contains("what are you"))
            return "I am H.A.I.V.A., your local-first Android assistant, Master.";
        if (c.contains("status") || c.contains("diagnostic"))
            return "Android Body is online. Local memory and offline command processing are ready.";
        if (c.contains("hello") || c.equals("hi") || c.equals("hey"))
            return "Hello, Master. H.A.I.V.A. is online and ready.";
        return "I received your command, Master. The offline command engine is active; a native local language model is the next model-provider module.";
    }
}
