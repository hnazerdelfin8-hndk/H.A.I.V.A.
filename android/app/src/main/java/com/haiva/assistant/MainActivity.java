package com.haiva.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
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
    private TextView status, orb, conversation, modeLabel;
    private Button micButton;
    private EditText input;
    private SpeechEngine speech;
    private WakeWordEngine wakeWord;
    private TTSManager tts;
    private CoreBridge core;
    private boolean voiceMode, commandMode, speaking;

    private int bg() { return Color.rgb(3, 7, 13); }
    private int panel() { return Color.rgb(9, 15, 25); }
    private int panel2() { return Color.rgb(13, 21, 34); }
    private int stroke() { return Color.rgb(40, 67, 92); }
    private int text() { return Color.rgb(235, 244, 255); }
    private int muted() { return Color.rgb(119, 142, 165); }
    private int accent() { return Color.rgb(96, 196, 255); }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(bg());
        w.setNavigationBarColor(bg());
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
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startVoiceMode();
        } else {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
        }
    }

    private TextView label(String value, float size, int color) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(size);
        v.setTextColor(color);
        v.setFontFeatureSettings("kern");
        return v;
    }

    private GradientDrawable rounded(int color, int border) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(30);
        if (border > 0) d.setStroke(1, stroke());
        return d;
    }

    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    private LinearLayout.LayoutParams weight(int h) { return new LinearLayout.LayoutParams(0, h, 1f); }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(16, 12, 16, 10);
        root.setBackgroundColor(bg());

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView brand = label("H.A.I.V.A.", 24, text());
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        top.addView(brand, weight(52));
        modeLabel = label("●  HYBRID", 10, accent());
        modeLabel.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        top.addView(modeLabel, lp(108, 48));
        Button settings = iconButton("⚙", 18);
        settings.setOnClickListener(v -> showSettings());
        top.addView(settings, lp(48, 48));
        root.addView(top, lp(-1, 52));

        TextView line = label("PERSONAL AI  •  VOICE CORE ONLINE", 9, muted());
        line.setLetterSpacing(.12f);
        root.addView(line, lp(-1, 25));

        LinearLayout reactor = new LinearLayout(this);
        reactor.setOrientation(LinearLayout.VERTICAL);
        reactor.setGravity(Gravity.CENTER);
        reactor.setPadding(0, 4, 0, 4);
        orb = label("◉", 72, text());
        orb.setGravity(Gravity.CENTER);
        orb.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        orb.setBackground(orbBackground());
        reactor.addView(orb, lp(188, 188));
        TextView coreTag = label("H.A.I.V.A. CORE", 10, accent());
        coreTag.setGravity(Gravity.CENTER);
        coreTag.setLetterSpacing(.18f);
        reactor.addView(coreTag, lp(-1, 28));
        status = label("STANDBY", 11, muted());
        status.setGravity(Gravity.CENTER);
        status.setLetterSpacing(.16f);
        reactor.addView(status, lp(-1, 24));
        root.addView(reactor, lp(-1, 245));

        LinearLayout chatPanel = new LinearLayout(this);
        chatPanel.setOrientation(LinearLayout.VERTICAL);
        chatPanel.setPadding(14, 10, 14, 10);
        chatPanel.setBackground(rounded(panel(), 1));
        TextView chatTitle = label("CONVERSATION", 9, muted());
        chatTitle.setLetterSpacing(.15f);
        chatPanel.addView(chatTitle, lp(-1, 24));
        conversation = label("", 13, text());
        conversation.setPadding(4, 2, 4, 4);
        append("H.A.I.V.A.", "Hello, Master. I'm online and ready.");
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(conversation);
        chatPanel.addView(scroll, weight(0));
        root.addView(chatPanel, weight(0));

        LinearLayout composer = new LinearLayout(this);
        composer.setGravity(Gravity.CENTER_VERTICAL);
        composer.setPadding(0, 9, 0, 0);
        input = new EditText(this);
        input.setSingleLine(true);
        input.setTextColor(text());
        input.setHintTextColor(muted());
        input.setTextSize(14);
        input.setHint("Talk to H.A.I.V.A...");
        input.setPadding(16, 0, 12, 0);
        input.setBackground(rounded(panel2(), 1));
        composer.addView(input, weight(54));
        micButton = iconButton("◉", 18);
        micButton.setContentDescription("Voice standby");
        micButton.setOnClickListener(v -> toggleVoiceMode());
        LinearLayout.LayoutParams mp = lp(54, 54); mp.setMargins(7, 0, 0, 0); composer.addView(micButton, mp);
        Button send = iconButton("➤", 18);
        send.setContentDescription("Send message");
        send.setOnClickListener(v -> { String c=input.getText().toString().trim(); input.setText(""); processCommand(c); });
        LinearLayout.LayoutParams sp = lp(54, 54); sp.setMargins(6, 0, 0, 0); composer.addView(send, sp);
        root.addView(composer, lp(-1, 63));

        TextView hint = label("WAKE WORD   •   “Yi, H.A.I.V.A.”", 9, muted());
        hint.setGravity(Gravity.CENTER);
        hint.setLetterSpacing(.08f);
        root.addView(hint, lp(-1, 24));
        setContentView(root);
    }

    private GradientDrawable orbBackground() {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(19, 67, 100), Color.rgb(4, 14, 25), Color.rgb(17, 45, 72)});
        d.setShape(GradientDrawable.OVAL);
        d.setStroke(2, Color.rgb(80, 180, 235));
        return d;
    }

    private Button iconButton(String value, int size) {
        Button b = new Button(this);
        b.setText(value); b.setTextSize(size); b.setTextColor(text()); b.setGravity(Gravity.CENTER);
        b.setAllCaps(false); b.setPadding(0,0,0,0); b.setBackground(rounded(panel2(),1));
        return b;
    }

    private void setStatus(String value) {
        if (status != null) status.setText(value);
        if (modeLabel != null) modeLabel.setText(voiceMode ? "●  HYBRID" : "○  VOICE OFF");
        if (orb != null) {
            if (value.contains("LISTEN")) orb.setText("◎");
            else if (value.contains("THINK")) orb.setText("◌");
            else if (value.contains("SPEAK")) orb.setText("◉");
            else orb.setText("◉");
            orb.animate().scaleX(1.06f).scaleY(1.06f).setDuration(260).withEndAction(() ->
                    orb.animate().scaleX(1f).scaleY(1f).setDuration(260)).start();
        }
    }

    private void showSettings() {
        LinearLayout page = page();
        page.addView(pageHeader("Settings", v -> { buildUi(); setupSpeechIfNeeded(); if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED) startVoiceMode(); }));
        page.addView(settingCard("AI", "HYBRID", "Chat + voice use the same H.A.I.V.A. Core"));
        page.addView(settingCard("MEMORY", "LOCAL • ON", "Persistent conversation memory on this device"));
        page.addView(settingCard("VOICE", "WAKE WORD", "Yi, H.A.I.V.A.  •  Android speech + TTS"));
        Button plugins = actionCard("🔌  PLUGIN MANAGER", "Google • GitHub • Notion • AI providers");
        plugins.setOnClickListener(v -> showPlugins()); page.addView(plugins, lp(-1,78));
        page.addView(settingCard("SECURITY", "LOCAL-FIRST", "Microphone permission and local runtime"));
        page.addView(settingCard("ABOUT", "H.A.I.V.A. ANDROID", "Personal AI assistant body"));
        setContentView(page);
    }

    private LinearLayout page() { LinearLayout p=new LinearLayout(this); p.setOrientation(LinearLayout.VERTICAL); p.setPadding(16,12,16,16); p.setBackgroundColor(bg()); return p; }
    private LinearLayout pageHeader(String title, View.OnClickListener backAction) {
        LinearLayout h=new LinearLayout(this); h.setGravity(Gravity.CENTER_VERTICAL); Button b=iconButton("‹",22); b.setOnClickListener(backAction); h.addView(b,lp(46,46)); TextView t=label(title,23,text()); t.setTypeface(Typeface.DEFAULT,Typeface.BOLD); h.addView(t,weight(50)); return h;
    }
    private TextView settingCard(String heading,String value,String body) { TextView v=label(heading+"\n"+value+"\n"+body,11,text()); v.setPadding(15,12,15,12); v.setBackground(rounded(panel(),1)); LinearLayout.LayoutParams p=lp(-1,74); p.setMargins(0,0,0,9); v.setLayoutParams(p); return v; }
    private Button actionCard(String title,String subtitle) { Button b=new Button(this); b.setText(title+"\n"+subtitle); b.setTextColor(text()); b.setTextSize(12); b.setGravity(Gravity.CENTER_VERTICAL|Gravity.LEFT); b.setAllCaps(false); b.setPadding(15,0,12,0); b.setBackground(rounded(panel2(),1)); return b; }

    private void showPlugins() {
        LinearLayout page=page(); page.addView(pageHeader("Plugin Manager",v->showSettings()));
        TextView intro=label("Connectors are shown honestly: CONNECT means no account is linked yet.",10,muted()); intro.setPadding(4,4,4,14); page.addView(intro,lp(-1,48));
        page.addView(pluginRow("GOOGLE","Gmail • Calendar • Drive • Docs","CONNECT"));
        page.addView(pluginRow("GITHUB","Repositories • Issues • Pull Requests","CONNECT"));
        page.addView(pluginRow("NOTION","Pages • Notes • Knowledge","CONNECT"));
        page.addView(pluginRow("AI PROVIDERS","OpenAI • Gemini • Groq","CONNECT"));
        page.addView(pluginRow("FILES & NOTES","Local device notes","READY"));
        page.addView(pluginRow("WEB RESEARCH","Requires online connector","NOT CONNECTED"));
        page.addView(pluginRow("AUTOMATION","Workflow connector","NOT CONNECTED"));
        setContentView(page);
    }
    private TextView pluginRow(String name,String desc,String state) { TextView v=label(name+"                         "+state+"\n"+desc,10,text()); v.setPadding(15,12,10,12); v.setBackground(rounded(panel(),1)); LinearLayout.LayoutParams p=lp(-1,66); p.setMargins(0,0,0,8); v.setLayoutParams(p); return v; }

    private void setupSpeechIfNeeded(){if(speech==null)setupSpeech();}
    private void setupSpeech(){
        if(!SpeechRecognizer.isRecognitionAvailable(this)){if(micButton!=null){micButton.setEnabled(false);micButton.setText("×");}return;}
        speech=new SpeechEngine(this,new SpeechEngine.Listener(){
            public void onReady(){if(voiceMode)setStatus(commandMode?"LISTENING":"STANDBY");}
            public void onResult(String value){handleVoiceText(value);}
            public void onError(int code){if(voiceMode&&!speaking)scheduleStandby();}
            public void onEnd(){if(voiceMode&&!speaking)scheduleStandby();}
        });
    }
    private void handleVoiceText(String raw){
        String heard=raw==null?"":raw.trim(); if(heard.isEmpty()){scheduleStandby();return;}
        if(!commandMode){
            if(!wakeWord.containsWakeWord(heard)){scheduleStandby();return;}
            String command=wakeWord.extractCommand(heard);
            if(!command.isEmpty()){processCommand(command);return;}
            commandMode=true; setStatus("LISTENING"); speak("Yes, Master. I'm listening.");
            handler.postDelayed(()->{if(voiceMode&&commandMode&&!speaking)speech.start();},1100); return;
        }
        commandMode=false; processCommand(heard);
    }
    private void processCommand(String command){
        if(command==null||command.trim().isEmpty())return; commandMode=false; setStatus("THINKING"); append("Master",command.trim());
        String response=core.dispatch(command.trim()); append("H.A.I.V.A.",response); speak(response);
    }
    private void speak(String value){if(tts!=null&&tts.isReady())tts.speak(value);else if(voiceMode)scheduleStandby();else setStatus("STANDBY");}
    private void toggleVoiceMode(){
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC_REQUEST);return;}
        if(voiceMode)stopVoiceMode();else startVoiceMode();
    }
    private void startVoiceMode(){
        if(speech==null)setupSpeech(); if(speech==null)return; voiceMode=true; commandMode=false;
        if(micButton!=null)micButton.setText("■"); setStatus("STANDBY"); speech.start();
    }
    private void stopVoiceMode(){
        voiceMode=false;commandMode=false;handler.removeCallbacksAndMessages(null);if(speech!=null)speech.cancel();if(tts!=null)tts.stop();if(micButton!=null)micButton.setText("◉");setStatus("STANDBY");
    }
    private void scheduleStandby(){if(!voiceMode||speaking||speech==null)return;handler.removeCallbacksAndMessages(null);handler.postDelayed(()->{if(voiceMode&&!speaking)speech.start();},650);}
    private void append(String who,String value){if(conversation==null)return;if(conversation.getText().length()>0)conversation.append("\n\n");conversation.append(who+"  ›  "+value);}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==MIC_REQUEST){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startVoiceMode();else setStatus("MICROPHONE PERMISSION REQUIRED");}}
    @Override protected void onResume(){super.onResume();if(!voiceMode&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)startVoiceMode();}
    @Override protected void onPause(){super.onPause();if(voiceMode)stopVoiceMode();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(speech!=null)speech.destroy();if(tts!=null)tts.shutdown();super.onDestroy();}
}
