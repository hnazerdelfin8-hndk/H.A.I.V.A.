package com.haiva.assistant.voice;

import android.content.Context;
import android.content.Intent;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.Locale;

public final class SpeechEngine {
    public interface Listener {
        void onReady();
        void onResult(String text);
        void onError(int code);
        void onEnd();
    }

    private final SpeechRecognizer recognizer;
    private final Listener listener;
    private boolean listening;

    public SpeechEngine(Context context, Listener listener) {
        this.listener = listener;
        recognizer = SpeechRecognizer.createSpeechRecognizer(context.getApplicationContext());
        recognizer.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(android.os.Bundle params) { listening = true; if (SpeechEngine.this.listener != null) SpeechEngine.this.listener.onReady(); }
            public void onBeginningOfSpeech() {}
            public void onRmsChanged(float rmsdB) {}
            public void onBufferReceived(byte[] buffer) {}
            public void onEndOfSpeech() { listening = false; if (SpeechEngine.this.listener != null) SpeechEngine.this.listener.onEnd(); }
            public void onError(int error) { listening = false; if (SpeechEngine.this.listener != null) SpeechEngine.this.listener.onError(error); }
            public void onResults(android.os.Bundle results) {
                listening = false;
                ArrayList<String> values = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (SpeechEngine.this.listener != null) SpeechEngine.this.listener.onResult(values == null || values.isEmpty() ? "" : values.get(0));
            }
            public void onPartialResults(android.os.Bundle partialResults) {}
            public void onEvent(int eventType, android.os.Bundle params) {}
        });
    }

    public boolean isListening() { return listening; }

    public void start() {
        if (listening) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try { recognizer.startListening(intent); } catch (Exception e) { listening = false; }
    }

    public void cancel() { listening = false; recognizer.cancel(); }
    public void destroy() { recognizer.destroy(); }
}
