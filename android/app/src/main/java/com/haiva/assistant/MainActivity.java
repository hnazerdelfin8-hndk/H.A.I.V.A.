package com.haiva.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.Color;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int MIC_REQUEST = 42;
    private static final String PREFS = "haiva_android";
    private static final String DEFAULT_ENDPOINT = "";
    private static final long RESTART_DELAY_MS = 650L;

    private TextView status;
    private TextView conversation;
    private EditText endpointInput;
    private EditText messageInput;
    private Button voiceButton;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean voiceMode = false;
    private boolean listening = false;
    private boolean commandMode = false;
    private boolean speaking = false;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        setupTts();
        setupSpeech();
        refreshCoreStatus();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 28, 28, 24);
        root.setBackgroundColor(Color.rgb(5, 7, 11));

        TextView title = new TextView(this);
        title.setText("H.A.I.V.A.");
        title.setTextColor(Color.WHITE); title.setTextSize(28); title.setGravity(17);
        root.addView(title, new LinearLayout.LayoutParams(-1, 60));

        TextView subtitle = new TextView(this);
        subtitle.setText("Hnazer Artificial Intelligence Voice Assistant");
        subtitle.setTextColor(Color.LTGRAY); subtitle.setGravity(17);
        root.addView(subtitle, new LinearLayout.LayoutParams(-1, 42));

        status = new TextView(this);
        status.setText("CORE NOT CONFIGURED"); status.setTextColor(Color.WHITE); status.setGravity(17);
        root.addView(status, new LinearLayout.LayoutParams(-1, 52));

        endpointInput = new EditText(this);
        endpointInput.setHint("HAIVA Core URL (your backend server)");
        endpointInput.setHintTextColor(Color.GRAY); endpointInput.setTextColor(Color.WHITE);
        endpointInput.setSingleLine(true);
        endpointInput.setText(getSharedPreferences(PREFS, MODE_PRIVATE).getString("endpoint", DEFAULT_ENDPOINT));
        root.addView(endpointInput, new LinearLayout.LayoutParams(-1, 60));

        LinearLayout coreRow = new LinearLayout(this);
        Button save = new Button(this); save.setText("Save Core URL");
        save.setOnClickListener(v -> saveEndpoint());
        coreRow.addView(save, new LinearLayout.LayoutParams(0, 54, 1f));
        Button test = new Button(this); test.setText("Test Core");
        test.setOnClickListener(v -> testCore());
        coreRow.addView(test, new LinearLayout.LayoutParams(0, 54, 1f));
        root.addView(coreRow);

        conversation = new TextView(this);
        conversation.setText("H.A.I.V.A.: Ready. Configure a reachable Core URL to enable AI replies.\n\n");
        conversation.setTextColor(Color.WHITE); conversation.setTextSize(16); conversation.setPadding(18,18,18,18);
        ScrollView scroll = new ScrollView(this); scroll.addView(conversation);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(-1, 0, 1f);
        scrollParams.setMargins(0, 12, 0, 12); root.addView(scroll, scrollParams);

        LinearLayout composer = new LinearLayout(this); composer.setOrientation(LinearLayout.HORIZONTAL);
        messageInput = new EditText(this); messageInput.setHint("Talk to H.A.I.V.A."); messageInput.setTextColor(Color.WHITE); messageInput.setHintTextColor(Color.GRAY);
        composer.addView(messageInput, new LinearLayout.LayoutParams(0, 60, 1f));
        Button send = new Button(this); send.setText("Send"); send.setOnClickListener(v -> sendMessage());
        composer.addView(send, new LinearLayout.LayoutParams(100, 60));
        root.addView(composer);

        voiceButton = new Button(this);
        voiceButton.setText("🎙 Start Standby");
        voiceButton.setOnClickListener(v -> toggleVoiceMode());
        root.addView(voiceButton, new LinearLayout.LayoutParams(-1, 62));

        TextView hint = new TextView(this);
        hint.setText("Standby wake words: “Yi, H.A.I.V.A.” / “Yo Haiva” / “Hey Haiva” / “Hi Haiva”");
        hint.setTextColor(Color.GRAY); hint.setGravity(17); hint.setTextSize(12);
        root.addView(hint, new LinearLayout.LayoutParams(-1, 42));
        setContentView(root);
    }

    private void setupTts() {
        tts = new TextToSpeech(this, result -> {
            if (result == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.US);
                tts.setSpeechRate(0.92f);
                tts.setPitch(1.0f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { speaking = true; }
                    @Override public void onDone(String id) {
                        speaking = false;
                        if (voiceMode) scheduleStandby();
                    }
                    @Override public void onError(String id) {
                        speaking = false;
                        if (voiceMode) scheduleStandby();
                    }
                });
            }
        });
    }

    private void saveEndpoint() {
        String value = normalizeEndpoint(endpointInput.getText().toString());
        endpointInput.setText(value);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("endpoint", value).apply();
        status.setText(value.isEmpty() ? "CORE NOT CONFIGURED" : "CORE URL SAVED");
    }

    private String normalizeEndpoint(String value) {
        value = value == null ? "" : value.trim();
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        if (value.endsWith("/api/chat")) value = value.substring(0, value.length() - 9);
        return value;
    }

    private String endpoint() {
        return normalizeEndpoint(getSharedPreferences(PREFS, MODE_PRIVATE).getString("endpoint", DEFAULT_ENDPOINT));
    }

    private void refreshCoreStatus() {
        status.setText(endpoint().isEmpty() ? "CORE NOT CONFIGURED" : "CORE URL READY");
    }

    private void testCore() {
        final String base = endpoint();
        if (base.isEmpty()) { status.setText("ENTER CORE URL FIRST"); append("H.A.I.V.A.", "I need a reachable HAIVA Core backend URL before I can connect."); return; }
        status.setText("TESTING CORE…");
        executor.execute(() -> {
            String result;
            try {
                result = postChat(base, "Reply with exactly: H.A.I.V.A. Core connection OK.");
            } catch (Exception e) {
                result = "Core test failed: " + safeError(e);
            }
            final String out = result;
            runOnUiThread(() -> { status.setText(out.startsWith("Core test failed") ? "CORE OFFLINE" : "CORE ONLINE"); append("H.A.I.V.A.", out); });
        });
    }

    private void sendMessage() {
        final String message = messageInput.getText().toString().trim();
        final String base = endpoint();
        if (message.isEmpty()) return;
        if (base.isEmpty()) { status.setText("CORE NOT CONFIGURED"); append("H.A.I.V.A.", "I can hear you, Master, but the AI Core backend is not configured on this phone yet."); return; }
        messageInput.setText("");
        commandMode = false;
        status.setText("THINKING");
        append("Master", message);
        executor.execute(() -> {
            String answer;
            try { answer = postChat(base, message); }
            catch (Exception e) { answer = "Core connection failed: " + safeError(e); }
            final String result = answer;
            runOnUiThread(() -> { status.setText("SPEAKING"); append("H.A.I.V.A.", result); speak(result); });
        });
    }

    private String postChat(String base, String message) throws Exception {
        HttpURLConnection c = null;
        try {
            URL url = new URL(base + "/api/chat");
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("POST"); c.setConnectTimeout(12000); c.setReadTimeout(30000); c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            c.setRequestProperty("Accept", "application/json");
            JSONObject body = new JSONObject(); body.put("message", message); body.put("history", new JSONArray());
            try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            java.io.InputStream stream = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (stream == null) throw new Exception("HTTP " + code + " with empty response");
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
            StringBuilder raw = new StringBuilder(); String line;
            while ((line = reader.readLine()) != null) raw.append(line);
            if (raw.length() == 0) throw new Exception("HTTP " + code + " with empty response");
            JSONObject response = new JSONObject(raw.toString());
            if (code >= 400) return response.optString("response", response.optString("error", "Core returned HTTP " + code));
            return response.optString("response", response.optString("message", response.optString("text", "Empty response from HAIVA Core.")));
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private String safeError(Exception e) {
        String msg = e.getMessage();
        if (msg == null || msg.trim().isEmpty()) return e.getClass().getSimpleName();
        return msg.length() > 140 ? msg.substring(0, 140) : msg;
    }

    private void append(String speaker, String text) { conversation.append(speaker + ": " + text + "\n\n"); }

    private void setupSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            voiceButton.setText("🎙 Voice unavailable");
            voiceButton.setEnabled(false);
            return;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle p) { listening = true; status.setText(commandMode ? "LISTENING FOR COMMAND" : "STANDBY — SAY YI, H.A.I.V.A."); }
            public void onBeginningOfSpeech() {}
            public void onRmsChanged(float r) {}
            public void onBufferReceived(byte[] b) {}
            public void onEndOfSpeech() { listening = false; }
            public void onError(int error) {
                listening = false;
                if (voiceMode && !speaking) scheduleStandby();
            }
            public void onResults(Bundle b) {
                listening = false;
                ArrayList<String> results = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (results == null || results.isEmpty()) { if (voiceMode) scheduleStandby(); return; }
                handleVoiceText(results.get(0));
            }
            public void onPartialResults(Bundle b) {}
            public void onEvent(int a, Bundle b) {}
        });
    }

    private void handleVoiceText(String raw) {
        String heard = raw == null ? "" : raw.trim();
        String lower = heard.toLowerCase(Locale.US);
        String command = removeWakeWord(lower, heard);
        if (!command.isEmpty()) {
            messageInput.setText(command);
            sendMessage();
            return;
        }
        if (!commandMode && containsWakeWord(lower)) {
            commandMode = true;
            status.setText("AWAKE — LISTENING FOR COMMAND");
            speak("Yes, Master. I'm listening.");
            handler.postDelayed(() -> { if (voiceMode && commandMode && !speaking) startRecognition(); }, 1400);
            return;
        }
        if (voiceMode) scheduleStandby();
    }

    private boolean containsWakeWord(String text) {
        return text.contains("yi haiva") || text.contains("yee haiva") || text.contains("yo haiva") ||
               text.contains("hey haiva") || text.contains("hi haiva") || text.equals("haiva") ||
               text.startsWith("haiva ");
    }

    private String removeWakeWord(String lower, String original) {
        String[] wakes = {"yi haiva", "yee haiva", "yo haiva", "hey haiva", "hi haiva", "haiva"};
        for (String wake : wakes) {
            int i = lower.indexOf(wake);
            if (i >= 0) {
                String rest = original.substring(i + wake.length()).trim();
                if (!rest.isEmpty()) return rest;
                return "";
            }
        }
        return commandMode ? original.trim() : "";
    }

    private void toggleVoiceMode() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
            return;
        }
        if (voiceMode) stopVoiceMode(); else startVoiceMode();
    }

    private void startVoiceMode() {
        voiceMode = true;
        commandMode = false;
        voiceButton.setText("⏹ Stop Standby");
        status.setText("STARTING STANDBY…");
        startRecognition();
    }

    private void stopVoiceMode() {
        voiceMode = false;
        commandMode = false;
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) recognizer.cancel();
        listening = false;
        voiceButton.setText("🎙 Start Standby");
        status.setText(endpoint().isEmpty() ? "CORE NOT CONFIGURED" : "CORE READY");
    }

    private void scheduleStandby() {
        if (!voiceMode || speaking) return;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            if (voiceMode && !speaking) startRecognition();
        }, RESTART_DELAY_MS);
    }

    private void startRecognition() {
        if (!voiceMode || speaking || recognizer == null || listening) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        listening = true;
        try { recognizer.startListening(intent); }
        catch (Exception e) { listening = false; scheduleStandby(); }
    }

    private void speak(String text) {
        if (tts != null && !text.isEmpty()) {
            speaking = true;
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "haiva-response");
        } else if (voiceMode) scheduleStandby();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MIC_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoiceMode();
            else status.setText("MICROPHONE PERMISSION REQUIRED");
        }
    }

    @Override protected void onPause() {
        super.onPause();
        if (voiceMode) stopVoiceMode();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) recognizer.destroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        executor.shutdownNow();
        super.onDestroy();
    }
}
