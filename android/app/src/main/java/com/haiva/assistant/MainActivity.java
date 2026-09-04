package com.haiva.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.animation.AlphaAnimation;
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
    private TextView status, orb, conversation;
    private Button micButton;
    private EditText input;
    private SpeechEngine speech;
    private WakeWordEngine wakeWord;
    private TTSManager tts;
    private CoreBridge core;
    private boolean voiceMode, commandMode, speaking;

    private int bg() { return Color.rgb(5, 8, 14); }
    private int card() { return Color.rgb(11, 16, 26); }
    private int line() { return Color.rgb(39, 55, 78); }
    private int text() { return Color.rgb(239, 244, 255); }
    private int muted() { return Color.rgb(137, 151, 175); }
    private int accent() { return Color.rgb(119, 190, 255); }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LocalMemory memory = new LocalMemory(this);
        LocalAIEngine ai = new LocalAIEngine();
        ToolManager tools = new ToolManager(this, memory);
        tts = new TTSManager(this, value -> {
            speaking = value;
            if (value) setStatus("SPEAKING");
            else if (voiceMode) scheduleStandby();
        });
        core = new CoreBridge(new HaivaBody(ai, memory, tools, tts));
        wakeWord = new WakeWordEngine();
        buildUi();
        setupSpeech();
        setStatus("STANDBY");
    }

    private TextView label(String value, float size, int color) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(size);
        v.setTextColor(color);
        return v;
    }

    private GradientDrawable rounded(int color, int stroke) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(26);
        if (stroke > 0) d.setStroke(1, line());
        return d;
    }

    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    private LinearLayout.LayoutParams weight(int h) { return new LinearLayout.LayoutParams(0, h, 1f); }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(18, 14, 18, 12);
        root.setBackgroundColor(bg());

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = label("H.A.I.V.A.", 25, text());
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        top.addView(title, weight(54));
        Button settings = iconButton("⚙");
        settings.setOnClickListener(v -> showSettings());
        top.addView(settings, lp(48, 48));
        root.addView(top, lp(-1, 54));

        LinearLayout modeRow = new LinearLayout(this);
        modeRow.setGravity(Gravity.CENTER_VERTICAL);
        modeRow.addView(label("●", 11, accent()), lp(18, 28));
        TextView mode = label("HYBRID", 11, text());
        mode.setTypeface(null, android.graphics.Typeface.BOLD);
        modeRow.addView(mode, lp(62, 28));
        modeRow.addView(label("ONLINE / OFFLINE", 10, muted()), weight(28));
        root.addView(modeRow, lp(-1, 30));

        orb = label("◉", 76, text());
        orb.setGravity(Gravity.CENTER);
        orb.setTypeface(null, android.graphics.Typeface.BOLD);
        orb.setBackground(makeOrb());
        root.addView(orb, lp(-1, 188));

        TextView name = label("H.A.I.V.A.", 15, text());
        name.setGravity(Gravity.CENTER);
        name.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(name, lp(-1, 27));
        status = label("STANDBY", 11, muted());
        status.setGravity(Gravity.CENTER);
        root.addView(status, lp(-1, 25));

        conversation = label("", 14, text());
        conversation.setPadding(16, 15, 16, 15);
        conversation.setBackground(rounded(card(), 1));
        append("H.A.I.V.A.", "Hello, Master. How can I assist you?");
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(conversation);
        root.addView(scroll, weight(0));

        LinearLayout composer = new LinearLayout(this);
        composer.setGravity(Gravity.CENTER_VERTICAL);
        composer.setPadding(0, 10, 0, 0);
        input = new EditText(this);
        input.setSingleLine(true);
        input.setTextColor(text());
        input.setHintTextColor(muted());
        input.setTextSize(14);
        input.setHint("Type a message...");
        input.setPadding(16, 0, 10, 0);
        input.setBackground(rounded(card(), 1));
        composer.addView(input, weight(56));

        micButton = iconButton("🎙");
        micButton.setContentDescription("Voice standby");
        micButton.setOnClickListener(v -> toggleVoiceMode());
        LinearLayout.LayoutParams micLp = lp(52, 56);
        micLp.setMargins(7, 0, 0, 0);
        composer.addView(micButton, micLp);

        Button send = iconButton("➤");
        send.setContentDescription("Send message");
        send.setOnClickListener(v -> {
            String command = input.getText().toString().trim();
            input.setText("");
            processCommand(command);
        });
        LinearLayout.LayoutParams sendLp = lp(52, 56);
        sendLp.setMargins(5, 0, 0, 0);
        composer.addView(send, sendLp);
        root.addView(composer, lp(-1, 66));

        TextView hint = label("Say  “Yi, H.A.I.V.A.”  to wake voice standby", 10, muted());
        hint.setGravity(Gravity.CENTER);
        root.addView(hint, lp(-1, 24));
        setContentView(root);
    }

    private Button iconButton(String value) {
        Button b = new Button(this);
        b.setText(value);
        b.setTextSize(19);
        b.setTextColor(text());
        b.setGravity(Gravity.CENTER);
        b.setAllCaps(false);
        b.setPadding(0, 0, 0, 0);
        b.setBackground(rounded(card(), 1));
        return b;
    }

    private GradientDrawable makeOrb() {
        GradientDrawable d = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(22, 43, 72), Color.rgb(8, 13, 23), Color.rgb(19, 34, 57)});
        d.setShape(GradientDrawable.OVAL);
        d.setStroke(2, Color.rgb(105, 170, 230));
        return d;
    }

    private void setStatus(String value) {
        if (status != null) status.setText(value);
        if (orb != null) {
            if (value.contains("LISTEN")) orb.setText("◉◉");
            else if (value.contains("THINK")) orb.setText("◌");
            else if (value.contains("SPEAK")) orb.setText("◎");
            else orb.setText("◉");
            AlphaAnimation pulse = new AlphaAnimation(0.72f, 1f);
            pulse.setDuration(value.contains("STANDBY") ? 900 : 420);
            pulse.setRepeatMode(AlphaAnimation.REVERSE);
            pulse.setRepeatCount(value.contains("STANDBY") ? 1 : 2);
            orb.startAnimation(pulse);
        }
    }

    private void showSettings() {
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(18, 14, 18, 16);
        page.setBackgroundColor(bg());
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        Button back = iconButton("‹");
        back.setOnClickListener(v -> { buildUi(); setupSpeechIfNeeded(); setStatus("STANDBY"); });
        head.addView(back, lp(44, 44));
        TextView title = label("Settings", 23, text());
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        head.addView(title, weight(52));
        page.addView(head, lp(-1, 52));
        page.addView(settingCard("AI", "Mode     HYBRID\nMemory   ON\nResponses shared by chat + voice"));
        page.addView(settingCard("VOICE", "Wake word     Yi, H.A.I.V.A.\nSpeech        Android voice service\nVoice output  ON"));
        Button plugins = actionCard("🔌  Plugins", "Connect Google, GitHub, Notion and other services");
        plugins.setOnClickListener(v -> showPlugins());
        page.addView(plugins, lp(-1, 78));
        page.addView(settingCard("SECURITY", "Microphone permission\nLocal-first memory\nNo Vercel dependency"));
        page.addView(settingCard("ABOUT", "H.A.I.V.A. Android Body\nPersonal assistant runtime"));
        setContentView(page);
    }

    private TextView settingCard(String heading, String body) {
        TextView v = label(heading + "\n\n" + body, 12, text());
        v.setPadding(16, 14, 16, 14);
        v.setBackground(rounded(card(), 1));
        LinearLayout.LayoutParams p = lp(-1, -2);
        p.setMargins(0, 0, 0, 10);
        v.setLayoutParams(p);
        return v;
    }

    private Button actionCard(String title, String subtitle) {
        Button b = new Button(this);
        b.setText(title + "\n" + subtitle + "   ›");
        b.setTextColor(text());
        b.setTextSize(13);
        b.setGravity(Gravity.CENTER_VERTICAL | Gravity.LEFT);
        b.setAllCaps(false);
        b.setPadding(16, 0, 12, 0);
        b.setBackground(rounded(card(), 1));
        return b;
    }

    private void showPlugins() {
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(18, 14, 18, 16);
        page.setBackgroundColor(bg());
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        Button back = iconButton("‹");
        back.setOnClickListener(v -> showSettings());
        head.addView(back, lp(44, 44));
        TextView title = label("Plugins", 23, text());
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        head.addView(title, weight(52));
        page.addView(head, lp(-1, 52));
        TextView intro = label("Connect services to H.A.I.V.A. Core.\nOnly configured connectors become active.", 11, muted());
        intro.setPadding(4, 5, 4, 14);
        page.addView(intro, lp(-1, 60));
        page.addView(pluginRow("Google", "Gmail • Calendar • Drive • Docs", "CONNECT"));
        page.addView(pluginRow("GitHub", "Repositories • Issues • Pull Requests", "CONNECT"));
        page.addView(pluginRow("Notion", "Pages • Notes • Knowledge", "CONNECT"));
        page.addView(pluginRow("AI Providers", "OpenAI • Gemini • Groq", "CONNECT"));
        page.addView(pluginRow("Files & Notes", "Local Android storage + notes", "READY"));
        page.addView(pluginRow("Web Research", "Online research connector", "ONLINE"));
        page.addView(pluginRow("Automation", "Actions and workflows", "READY"));
        setContentView(page);
    }

    private TextView pluginRow(String name, String description, String state) {
        TextView v = label(name + "    " + state + "\n" + description, 12, text());
        v.setPadding(16, 13, 12, 13);
        v.setBackground(rounded(card(), 1));
        LinearLayout.LayoutParams p = lp(-1, 70);
        p.setMargins(0, 0, 0, 8);
        v.setLayoutParams(p);
        return v;
    }

    private void setupSpeechIfNeeded() { if (speech == null) setupSpeech(); }

    private void setupSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            if (micButton != null) { micButton.setEnabled(false); micButton.setText("×"); }
            return;
        }
        speech = new SpeechEngine(this, new SpeechEngine.Listener() {
            public void onReady() { if (voiceMode) setStatus(commandMode ? "LISTENING" : "STANDBY"); }
            public void onResult(String value) { handleVoiceText(value); }
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
            setStatus("LISTENING");
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
        setStatus("THINKING");
        append("Master", command.trim());
        String response = core.dispatch(command.trim());
        append("H.A.I.V.A.", response);
        setStatus("SPEAKING");
        speak(response);
    }

    private void speak(String value) {
        if (tts != null && tts.isReady()) tts.speak(value);
        else if (voiceMode) scheduleStandby();
        else setStatus("STANDBY");
    }

    private void toggleVoiceMode() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
            return;
        }
        if (voiceMode) stopVoiceMode(); else startVoiceMode();
    }

    private void startVoiceMode() {
        if (speech == null) setupSpeech();
        if (speech == null) return;
        voiceMode = true;
        commandMode = false;
        if (micButton != null) micButton.setText("■");
        setStatus("STANDBY");
        speech.start();
    }

    private void stopVoiceMode() {
        voiceMode = false;
        commandMode = false;
        handler.removeCallbacksAndMessages(null);
        if (speech != null) speech.cancel();
        if (tts != null) tts.stop();
        if (micButton != null) micButton.setText("🎙");
        setStatus("STANDBY");
    }

    private void scheduleStandby() {
        if (!voiceMode || speaking || speech == null) return;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> { if (voiceMode && !speaking) speech.start(); }, 650);
    }

    private void append(String who, String value) {
        if (conversation == null) return;
        if (conversation.getText().length() > 0) conversation.append("\n\n");
        conversation.append(who + ": " + value);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MIC_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoiceMode();
            else setStatus("MICROPHONE PERMISSION REQUIRED");
        }
    }

    @Override protected void onPause() {
        super.onPause();
        if (voiceMode) stopVoiceMode();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (speech != null) speech.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }
}
