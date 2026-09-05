package com.haiva.bridge

interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()
    fun speak(text: String)
    fun notify(title: String, message: String)
    fun getBattery(): String
    fun getDeviceInfo(): String
    fun openApp(name: String): String
}
