package com.haiva.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.ViewGroup;
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
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int MIC_REQUEST = 42;
    private static final String PREFS = "haiva_android";
    private static final String DEFAULT_ENDPOINT = "";

    private TextView status;
    private TextView conversation;
    private EditText endpointInput;
    private EditText messageInput;
    private Button voiceButton;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean listening = false;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        tts = new TextToSpeech(this, result -> { if (result == TextToSpeech.SUCCESS) tts.setLanguage(Locale.US); });
        setupSpeech();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 32, 28, 24);
        root.setBackgroundColor(Color.rgb(5, 7, 11));

        TextView title = new TextView(this);
        title.setText("H.A.I.V.A.");
        title.setTextColor(Color.WHITE); title.setTextSize(28); title.setGravity(17);
        root.addView(title, new LinearLayout.LayoutParams(-1, 60));

        TextView subtitle = new TextView(this);
        subtitle.setText("Hnazer Artificial Intelligence Voice Assistant");
        subtitle.setTextColor(Color.LTGRAY); subtitle.setGravity(17);
        root.addView(subtitle, new LinearLayout.LayoutParams(-1, 44));

        status = new TextView(this);
        status.setText("READY — Configure HAIVA Core"); status.setTextColor(Color.WHITE); status.setGravity(17);
        root.addView(status, new LinearLayout.LayoutParams(-1, 52));

        endpointInput = new EditText(this);
        endpointInput.setHint("HAIVA Core URL, e.g. https://your-server");
        endpointInput.setHintTextColor(Color.GRAY); endpointInput.setTextColor(Color.WHITE);
        endpointInput.setSingleLine(true);
        endpointInput.setText(getPreferences(0).getString("endpoint", DEFAULT_ENDPOINT));
        root.addView(endpointInput, new LinearLayout.LayoutParams(-1, 60));

        Button save = new Button(this); save.setText("Save Core URL");
        save.setOnClickListener(v -> saveEndpoint());
        root.addView(save, new LinearLayout.LayoutParams(-1, 54));

        conversation = new TextView(this);
        conversation.setText("H.A.I.V.A.: Core connection is not configured yet.\n");
        conversation.setTextColor(Color.WHITE); conversation.setTextSize(16); conversation.setPadding(18,18,18,18);
        ScrollView scroll = new ScrollView(this); scroll.addView(conversation);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(-1, 0, 1f);
        scrollParams.setMargins(0, 16, 0, 16); root.addView(scroll, scrollParams);

        LinearLayout composer = new LinearLayout(this); composer.setOrientation(LinearLayout.HORIZONTAL);
        messageInput = new EditText(this); messageInput.setHint("Talk to H.A.I.V.A."); messageInput.setTextColor(Color.WHITE); messageInput.setHintTextColor(Color.GRAY);
        composer.addView(messageInput, new LinearLayout.LayoutParams(0, 60, 1f));
        Button send = new Button(this); send.setText("Send"); send.setOnClickListener(v -> sendMessage());
        composer.addView(send, new LinearLayout.LayoutParams(100, 60));
        root.addView(composer);

        voiceButton = new Button(this); voiceButton.setText("🎙 Activate Voice"); voiceButton.setOnClickListener(v -> toggleVoice());
        root.addView(voiceButton, new LinearLayout.LayoutParams(-1, 60));

        setContentView(root);
    }

    private void saveEndpoint() {
        String value = endpointInput.getText().toString().trim();
        if (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        getPreferences(0).edit().putString("endpoint", value).apply();
        status.setText(value.isEmpty() ? "NOT CONFIGURED" : "CORE URL SAVED");
    }

    private String endpoint() { return getPreferences(0).getString("endpoint", DEFAULT_ENDPOINT); }

    private void sendMessage() {
        final String message = messageInput.getText().toString().trim();
        final String base = endpoint();
        if (message.isEmpty()) return;
        if (base.isEmpty()) { append("H.A.I.V.A.", "Set the HAIVA Core URL first."); return; }
        messageInput.setText(""); status.setText("THINKING"); append("Master", message);
        executor.execute(() -> {
            String answer;
            try { answer = postChat(base, message); }
            catch (Exception e) { answer = "Core connection failed. Check the server URL and network."; }
            final String result = answer;
            runOnUiThread(() -> { status.setText("READY"); append("H.A.I.V.A.", result); speak(result); });
        });
    }

    private String postChat(String base, String message) throws Exception {
        URL url = new URL(base + "/api/chat");
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestMethod("POST"); c.setConnectTimeout(12000); c.setReadTimeout(30000); c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        JSONObject body = new JSONObject(); body.put("message", message); body.put("history", new org.json.JSONArray());
        try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        int code = c.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder raw = new StringBuilder(); String line; while ((line = reader.readLine()) != null) raw.append(line);
        c.disconnect();
        JSONObject response = new JSONObject(raw.toString());
        if (code >= 400) return response.optString("response", "Core returned HTTP " + code);
        return response.optString("response", response.optString("message", "Empty response from HAIVA Core."));
    }

    private void append(String speaker, String text) { conversation.append(speaker + ": " + text + "\n\n"); }

    private void setupSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { voiceButton.setText("🎙 Voice unavailable"); return; }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle p) { status.setText("LISTENING"); }
            public void onBeginningOfSpeech() {}
            public void onRmsChanged(float r) {}
            public void onBufferReceived(byte[] b) {}
            public void onEndOfSpeech() { listening = false; voiceButton.setText("🎙 Activate Voice"); }
            public void onError(int e) { listening = false; status.setText("VOICE READY"); voiceButton.setText("🎙 Activate Voice"); }
            public void onResults(Bundle b) { ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (r != null && !r.isEmpty()) { messageInput.setText(r.get(0)); sendMessage(); } }
            public void onPartialResults(Bundle b) {}
            public void onEvent(int a, Bundle b) {}
        });
    }

    private void toggleVoice() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST); return; }
        if (listening) { recognizer.stopListening(); listening = false; voiceButton.setText("🎙 Activate Voice"); return; }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH); intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM); intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US); intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        listening = true; voiceButton.setText("⏹ Stop Voice"); recognizer.startListening(intent);
    }

    private void speak(String text) { if (tts != null && !text.isEmpty()) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "haiva-response"); }

    @Override protected void onDestroy() { if (recognizer != null) recognizer.destroy(); if (tts != null) { tts.stop(); tts.shutdown(); } executor.shutdownNow(); super.onDestroy(); }
}
