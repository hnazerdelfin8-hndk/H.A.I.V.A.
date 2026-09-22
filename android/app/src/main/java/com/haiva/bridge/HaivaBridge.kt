package com.haiva.bridge

import android.app.Activity
import android.webkit.JavascriptInterface
import com.haiva.app.DuplexAudioMonitor

interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()

    @JavascriptInterface
    fun startDuplexAudio(turn: Long) {
        val activity = this as? Activity ?: return
        DuplexAudioMonitor.start(activity, turn)
    }

    @JavascriptInterface
    fun stopDuplexAudio() {
        DuplexAudioMonitor.stop()
    }

    fun speak(text: String)
    fun stopSpeaking()
    fun notify(title: String, message: String)
}
