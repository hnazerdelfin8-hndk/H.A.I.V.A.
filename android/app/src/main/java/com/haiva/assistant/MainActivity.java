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
import android.view.View;
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
    private TextView status, conversation, orb;
    private Button voiceButton;
    private SpeechEngine speech;
    private WakeWordEngine wakeWord;
    private TTSManager tts;
    private CoreBridge core;
    private boolean voiceMode, commandMode, speaking;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LocalMemory memory = new LocalMemory(this);
        LocalAIEngine ai = new LocalAIEngine();
        ToolManager tools = new ToolManager(this, memory);
        tts = new TTSManager(this, value -> { speaking = value; if (!value && voiceMode) scheduleStandby(); });
        core = new CoreBridge(new HaivaBody(ai, memory, tools, tts));
        wakeWord = new WakeWordEngine();
        buildUi(); setupSpeech(); setStatus("STANDBY");
    }

    private TextView label(String text, int size) {
        TextView v = new TextView(this); v.setText(text); v.setTextColor(Color.WHITE); v.setTextSize(size); v.setGravity(Gravity.CENTER); return v;
    }

    private GradientDrawable bg(int stroke) {
        GradientDrawable d = new GradientDrawable(); d.setColor(Color.rgb(10,14,22)); d.setCornerRadius(28); d.setStroke(2, Color.rgb(70,90,125)); return d;
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(22,18,22,18); root.setBackgroundColor(Color.rgb(3,5,9));

        LinearLayout top = new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = label("H.A.I.V.A.", 27); title.setGravity(Gravity.CENTER_VERTICAL); top.addView(title, new LinearLayout.LayoutParams(0,64,1));
        Button settings = new Button(this); settings.setText("⚙"); settings.setTextSize(22); settings.setOnClickListener(v -> showSettings()); top.addView(settings, new LinearLayout.LayoutParams(64,64));
        root.addView(top);

        TextView mode = label("HYBRID BODY  •  ONLINE / OFFLINE READY", 11); mode.setTextColor(Color.LTGRAY); root.addView(mode, new LinearLayout.LayoutParams(-1,32));

        orb = label("◉", 74); orb.setTextColor(Color.WHITE); orb.setBackground(makeOrb()); root.addView(orb, new LinearLayout.LayoutParams(-1,230));
        status = label("STANDBY", 14); status.setPadding(0,8,0,8); root.addView(status, new LinearLayout.LayoutParams(-1,48));

        conversation = new TextView(this); conversation.setTextColor(Color.WHITE); conversation.setTextSize(15); conversation.setPadding(18,16,18,16); conversation.setBackground(bg(1)); conversation.setText("H.A.I.V.A.: Ready, Master.\n\n");
        ScrollView scroll = new ScrollView(this); scroll.addView(conversation); root.addView(scroll, new LinearLayout.LayoutParams(-1,0,1f));

        LinearLayout composer = new LinearLayout(this); composer.setPadding(0,10,0,0);
        EditText input = new EditText(this); input.setHint("Talk to H.A.I.V.A."); input.setTextColor(Color.WHITE); input.setHintTextColor(Color.GRAY); input.setSingleLine(true); composer.addView(input, new LinearLayout.LayoutParams(0,58,1));
        Button send = new Button(this); send.setText("SEND"); send.setOnClickListener(v -> { String text=input.getText().toString().trim(); input.setText(""); processCommand(text); }); composer.addView(send,new LinearLayout.LayoutParams(105,58)); root.addView(composer);

        voiceButton = new Button(this); voiceButton.setText("🎙  START STANDBY"); voiceButton.setOnClickListener(v -> toggleVoiceMode()); root.addView(voiceButton,new LinearLayout.LayoutParams(-1,60));
        TextView hint = label("Say:  “Yi, H.A.I.V.A.”  •  Voice standby", 11); hint.setTextColor(Color.GRAY); root.addView(hint,new LinearLayout.LayoutParams(-1,34));
        setContentView(root);
    }

    private GradientDrawable makeOrb() { GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(45,65,105),Color.rgb(8,12,20)}); d.setShape(GradientDrawable.OVAL); d.setStroke(4,Color.rgb(150,180,230)); return d; }
    private void setStatus(String value) { if(status!=null) status.setText(value); if(orb!=null) orb.setText(value.contains("LISTEN")?"◉◉":value.contains("THINK")?"◌":value.contains("SPEAK")?"◎":"◉"); }

    private void showSettings() {
        LinearLayout page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); page.setPadding(22,20,22,20); page.setBackgroundColor(Color.rgb(3,5,9));
        LinearLayout head=new LinearLayout(this); TextView title=label("SETTINGS",26); head.addView(title,new LinearLayout.LayoutParams(0,70,1)); Button back=new Button(this); back.setText("←"); back.setOnClickListener(v->buildUiAndSpeechSafe()); head.addView(back,new LinearLayout.LayoutParams(70,70)); page.addView(head);
        page.addView(section("AI MODE", "Automatic: ONLINE when connected • OFFLINE when disconnected"));
        page.addView(section("VOICE", "Wake phrase: Yi, H.A.I.V.A. • Android TTS"));
        page.addView(section("MEMORY", "Local conversation memory • persistent on device"));
        page.addView(section("🔌 PLUGINS", "GitHub     ● READY\nAI Builder  ● READY\nFiles      ● READY\nNotes      ● READY\nCalendar   ○ NOT CONNECTED\nWeb Research ○ ONLINE ONLY\nAutomation ○ READY"));
        page.addView(section("SECURITY", "Microphone permission • Local-first processing • No Vercel dependency"));
        setContentView(page);
    }

    private TextView section(String heading,String body){ TextView v=new TextView(this); v.setText(heading+"\n\n"+body); v.setTextColor(Color.WHITE); v.setTextSize(14); v.setPadding(20,18,20,18); v.setBackground(bg(1)); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,0,0,12); v.setLayoutParams(p); return v; }
    private void buildUiAndSpeechSafe(){ buildUi(); if(speech==null) setupSpeech(); setStatus("STANDBY"); }

    private void setupSpeech(){ if(!SpeechRecognizer.isRecognitionAvailable(this)){ voiceButton.setEnabled(false); voiceButton.setText("🎙 SPEECH UNAVAILABLE"); return; } speech=new SpeechEngine(this,new SpeechEngine.Listener(){ public void onReady(){if(voiceMode)setStatus(commandMode?"LISTENING":"STANDBY — SAY YI, H.A.I.V.A.");} public void onResult(String text){handleVoiceText(text);} public void onError(int code){if(voiceMode&&!speaking)scheduleStandby();} public void onEnd(){if(voiceMode&&!speaking)scheduleStandby();}}); }
    private void handleVoiceText(String raw){String heard=raw==null?"":raw.trim();if(heard.isEmpty()){scheduleStandby();return;}if(!commandMode){if(!wakeWord.containsWakeWord(heard)){scheduleStandby();return;}String command=wakeWord.extractCommand(heard);if(!command.isEmpty()){processCommand(command);return;}commandMode=true;setStatus("WAKE DETECTED — LISTENING");speak("Yes, Master. I'm listening.");handler.postDelayed(()->{if(voiceMode&&commandMode&&!speaking)speech.start();},1300);return;}commandMode=false;processCommand(heard);}
    private void processCommand(String command){if(command==null||command.trim().isEmpty())return;commandMode=false;setStatus("THINKING");append("Master",command);String response=core.dispatch(command);setStatus("SPEAKING");append("H.A.I.V.A.",response);speak(response);}
    private void speak(String text){if(tts!=null&&tts.isReady())tts.speak(text);else scheduleStandby();}
    private void toggleVoiceMode(){if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC_REQUEST);return;}if(voiceMode)stopVoiceMode();else startVoiceMode();}
    private void startVoiceMode(){voiceMode=true;commandMode=false;voiceButton.setText("⏹ STOP STANDBY");setStatus("STARTING STANDBY");speech.start();}
    private void stopVoiceMode(){voiceMode=false;commandMode=false;handler.removeCallbacksAndMessages(null);if(speech!=null)speech.cancel();if(tts!=null)tts.stop();voiceButton.setText("🎙 START STANDBY");setStatus("STANDBY");}
    private void scheduleStandby(){if(!voiceMode||speaking)return;handler.removeCallbacksAndMessages(null);handler.postDelayed(()->{if(voiceMode&&!speaking&&speech!=null)speech.start();},650);}
    private void append(String who,String text){conversation.append(who+": "+text+"\n\n");}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==MIC_REQUEST){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startVoiceMode();else setStatus("MICROPHONE PERMISSION REQUIRED");}}
    @Override protected void onPause(){super.onPause();if(voiceMode)stopVoiceMode();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(speech!=null)speech.destroy();if(tts!=null)tts.shutdown();super.onDestroy();}
}
