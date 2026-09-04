package com.haiva.assistant.tts;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import java.util.Locale;

public final class TTSManager {
    public interface Listener { void onSpeaking(boolean speaking); }
    private TextToSpeech tts;
    private boolean ready;
    private Listener listener;

    public TTSManager(Context context, Listener listener) {
        this.listener = listener;
        tts = new TextToSpeech(context.getApplicationContext(), result -> {
            ready = result == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setLanguage(Locale.US);
                tts.setSpeechRate(0.92f);
                tts.setPitch(1.0f);
            }
        });
    }

    public boolean isReady() { return ready; }

    public void speak(String text) {
        if (!ready || text == null || text.trim().isEmpty()) return;
        if (listener != null) listener.onSpeaking(true);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "haiva-response");
    }

    public void stop() { if (tts != null) tts.stop(); if (listener != null) listener.onSpeaking(false); }
    public void shutdown() { if (tts != null) { tts.stop(); tts.shutdown(); } ready = false; }
}
