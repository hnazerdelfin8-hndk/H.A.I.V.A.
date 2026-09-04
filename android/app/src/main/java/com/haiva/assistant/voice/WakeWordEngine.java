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
        String normalized = normalize(text);
        for (String wake : WAKE_WORDS) {
            int index = normalized.indexOf(wake);
            if (index >= 0) return normalized.substring(index + wake.length()).trim();
        }
        return "";
    }

    private String normalize(String text) {
        if (text == null) return "";
        String value = text.trim().toLowerCase(Locale.US);
        // Accept natural spoken/transcribed forms such as "Yi, H.A.I.V.A.".
        value = value.replaceAll("h[\\s.\\-_:]*a[\\s.\\-_:]*i[\\s.\\-_:]*v[\\s.\\-_:]*a", "haiva");
        value = value.replaceAll("[^a-z0-9]+", " ");
        return value.replaceAll("\\s+", " ").trim();
    }
}
