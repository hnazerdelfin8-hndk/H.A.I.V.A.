package com.haiva.bridge

interface HaivaBridge {
    fun startVoiceCapture(sessionId: String)
    fun stopVoiceCapture(sessionId: String)
    fun speak(text: String)
    fun stopSpeaking()
    fun notify(title: String, message: String)
}
