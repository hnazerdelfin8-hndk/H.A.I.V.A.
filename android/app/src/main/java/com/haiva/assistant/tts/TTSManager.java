package com.haiva.assistant.tts;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

public final class TTSManager {
    public interface Listener { void onSpeaking(boolean speaking); }
    private TextToSpeech tts;
    private volatile boolean ready;
    private final Listener listener;

    public TTSManager(Context context, Listener listener) {
        this.listener = listener;
        tts = new TextToSpeech(context.getApplicationContext(), result -> {
            ready = result == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setLanguage(Locale.US);
                tts.setSpeechRate(0.92f);
                tts.setPitch(1.0f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { if (TTSManager.this.listener != null) TTSManager.this.listener.onSpeaking(true); }
                    @Override public void onDone(String id) { if (TTSManager.this.listener != null) TTSManager.this.listener.onSpeaking(false); }
                    @Override public void onError(String id) { if (TTSManager.this.listener != null) TTSManager.this.listener.onSpeaking(false); }
                });
            }
        });
    }

    public boolean isReady() { return ready; }
    public void speak(String text) {
        if (!ready || text == null || text.trim().isEmpty()) return;
        tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "haiva-response");
    }
    public void stop() { if (tts != null) tts.stop(); }
    public void shutdown() { if (tts != null) { tts.stop(); tts.shutdown(); } ready = false; }
}
