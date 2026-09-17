package com.haiva.bridge

interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()
    fun startV3VoiceCapture()
    fun stopV3VoiceCapture()
    fun startDuplexInterruptMonitor(turn: Long)
    fun stopDuplexInterruptMonitor()
    fun speak(text: String)
    fun stopSpeaking()
    fun notify(title: String, message: String)
}
