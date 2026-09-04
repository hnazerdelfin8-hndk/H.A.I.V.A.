package com.haiva.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.SpeechRecognizer;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.haiva.assistant.ai.LocalAIEngine;
import com.haiva.assistant.bridge.CoreBridge;
import com.haiva.assistant.body.HaivaBody;
import com.haiva.assistant.memory.LocalMemory;
import com.haiva.assistant.tools.ToolManager;
import com.haiva.assistant.tts.TTSManager;
import com.haiva.assistant.voice.SpeechEngine;
import com.haiva.assistant.voice.WakeWordEngine;

public class MainActivity extends Activity {
    private static final int MIC_REQUEST = 42;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView status;
    private TextView conversation;
    private Button voiceButton;
    private SpeechEngine speech;
    private WakeWordEngine wakeWord;
    private TTSManager tts;
    private CoreBridge core;
    private boolean voiceMode;
    private boolean commandMode;
    private boolean speaking;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LocalMemory memory = new LocalMemory(this);
        LocalAIEngine ai = new LocalAIEngine();
        ToolManager tools = new ToolManager(this, memory);
        tts = new TTSManager(this, value -> {
            speaking = value;
            if (!value && voiceMode) scheduleStandby();
        });
        core = new CoreBridge(new HaivaBody(ai, memory, tools, tts));
        wakeWord = new WakeWordEngine();
        buildUi();
        setupSpeech();
        setStatus("STANDBY — LOCAL BODY READY");
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 28, 28, 24);
        root.setBackgroundColor(Color.rgb(5, 7, 11));

        TextView title = new TextView(this);
        title.setText("H.A.I.V.A."); title.setTextColor(Color.WHITE); title.setTextSize(28); title.setGravity(Gravity.CENTER);
        root.addView(title, new LinearLayout.LayoutParams(-1, 60));

        TextView subtitle = new TextView(this);
        subtitle.setText("LOCAL ANDROID BODY"); subtitle.setTextColor(Color.LTGRAY); subtitle.setGravity(Gravity.CENTER);
        root.addView(subtitle, new LinearLayout.LayoutParams(-1, 42));

        status = new TextView(this);
        status.setTextColor(Color.WHITE); status.setGravity(Gravity.CENTER); status.setTextSize(14);
        root.addView(status, new LinearLayout.LayoutParams(-1, 52));

        conversation = new TextView(this);
        conversation.setTextColor(Color.WHITE); conversation.setTextSize(16); conversation.setPadding(18,18,18,18);
        conversation.setText("H.A.I.V.A.: Local-first Android Body initialized.\n\n");
        ScrollView scroll = new ScrollView(this); scroll.addView(conversation);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));

        LinearLayout composer = new LinearLayout(this);
        EditText input = new EditText(this);
        input.setHint("Talk to H.A.I.V.A."); input.setTextColor(Color.WHITE); input.setHintTextColor(Color.GRAY);
        composer.addView(input, new LinearLayout.LayoutParams(0, 60, 1f));
        Button send = new Button(this); send.setText("Send");
        send.setOnClickListener(v -> { String text = input.getText().toString().trim(); input.setText(""); processCommand(text); });
        composer.addView(send, new LinearLayout.LayoutParams(100, 60));
        root.addView(composer);

        voiceButton = new Button(this); voiceButton.setText("🎙 Start Standby");
        voiceButton.setOnClickListener(v -> toggleVoiceMode());
        root.addView(voiceButton, new LinearLayout.LayoutParams(-1, 62));

        TextView hint = new TextView(this);
        hint.setText("Wake phrase: Yi, H.A.I.V.A. • Local memory • Android TTS");
        hint.setTextColor(Color.GRAY); hint.setGravity(Gravity.CENTER); hint.setTextSize(12);
        root.addView(hint, new LinearLayout.LayoutParams(-1, 42));
        setContentView(root);
    }

    private void setupSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            voiceButton.setEnabled(false); voiceButton.setText("🎙 Speech unavailable"); return;
        }
        speech = new SpeechEngine(this, new SpeechEngine.Listener() {
            public void onReady() { if (voiceMode) setStatus(commandMode ? "LISTENING FOR COMMAND" : "STANDBY — SAY YI, H.A.I.V.A."); }
            public void onResult(String text) { handleVoiceText(text); }
            public void onError(int code) { if (voiceMode && !speaking) scheduleStandby(); }
            public void onEnd() { if (voiceMode && !speaking) scheduleStandby(); }
        });
    }

    private void handleVoiceText(String raw) {
        String heard = raw == null ? "" : raw.trim();
        if (heard.isEmpty()) { scheduleStandby(); return; }
        if (!commandMode) {
            if (!wakeWord.containsWakeWord(heard)) { scheduleStandby(); return; }
            String command = wakeWord.extractCommand(heard);
            if (!command.isEmpty()) { processCommand(command); return; }
            commandMode = true;
            setStatus("WAKE DETECTED — LISTENING");
            speak("Yes, Master. I'm listening.");
            handler.postDelayed(() -> { if (voiceMode && commandMode && !speaking) speech.start(); }, 1300);
            return;
        }
        commandMode = false;
        processCommand(heard);
    }

    private void processCommand(String command) {
        if (command == null || command.trim().isEmpty()) return;
        commandMode = false;
        setStatus("THINKING — LOCAL");
        append("Master", command);
        String response = core.dispatch(command);
        setStatus("SPEAKING"); append("H.A.I.V.A.", response);
        speak(response);
    }

    private void speak(String text) { if (tts != null && tts.isReady()) tts.speak(text); else scheduleStandby(); }

    private void toggleVoiceMode() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST); return;
        }
        if (voiceMode) stopVoiceMode(); else startVoiceMode();
    }

    private void startVoiceMode() {
        voiceMode = true; commandMode = false; voiceButton.setText("⏹ Stop Standby"); setStatus("STARTING STANDBY"); speech.start();
    }

    private void stopVoiceMode() {
        voiceMode = false; commandMode = false; handler.removeCallbacksAndMessages(null);
        if (speech != null) speech.cancel();
        if (tts != null) tts.stop();
        voiceButton.setText("🎙 Start Standby"); setStatus("STANDBY — LOCAL BODY READY");
    }

    private void scheduleStandby() {
        if (!voiceMode || speaking) return;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> { if (voiceMode && !speaking && speech != null) speech.start(); }, 650);
    }

    private void setStatus(String value) { if (status != null) status.setText(value); }
    private void append(String who, String text) { conversation.append(who + ": " + text + "\n\n"); }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MIC_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoiceMode();
            else setStatus("MICROPHONE PERMISSION REQUIRED");
        }
    }

    @Override protected void onPause() { super.onPause(); if (voiceMode) stopVoiceMode(); }
    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (speech != null) speech.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }
}
