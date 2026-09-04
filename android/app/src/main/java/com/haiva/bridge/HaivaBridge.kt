package com.haiva.bridge

interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()
    fun speak(text: String)
    fun notify(title: String, message: String)
}
