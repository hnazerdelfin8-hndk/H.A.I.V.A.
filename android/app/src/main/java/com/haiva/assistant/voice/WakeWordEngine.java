package com.haiva.assistant.voice;

import java.util.Locale;

public final class WakeWordEngine {
    private static final String[] WAKE_WORDS = {
        "yi haiva", "yee haiva", "yo haiva", "hey haiva", "hi haiva", "haiva"
    };

    public boolean containsWakeWord(String text) {
        String normalized = normalize(text);
        for (String wake : WAKE_WORDS) {
            if (normalized.equals(wake) || normalized.startsWith(wake + " ") || normalized.contains(" " + wake + " ")) return true;
        }
        return false;
    }

    public String extractCommand(String text) {
        if (text == null) return "";
        String normalized = normalize(text);
        for (String wake : WAKE_WORDS) {
            int index = normalized.indexOf(wake);
            if (index >= 0) return text.trim().substring(Math.min(text.trim().length(), index + wake.length())).trim();
        }
        return "";
    }

    private String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.US).replaceAll("\\s+", " ");
    }
}
