package com.haiva.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import com.haiva.app.PhoneCapabilities

interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()
    fun speak(text: String)
    fun notify(title: String, message: String)

    @JavascriptInterface
    fun getBattery(): String = phoneCapabilities().battery()

    @JavascriptInterface
    fun getDeviceInfo(): String = phoneCapabilities().deviceInfo()

    @JavascriptInterface
    fun openApp(name: String): String = phoneCapabilities().openApp(name)

    private fun phoneCapabilities(): PhoneCapabilities {
        val context = this as? Context ?: throw IllegalStateException("H.A.I.V.A. bridge is not attached to Android Context")
        return PhoneCapabilities(context)
    }
}
