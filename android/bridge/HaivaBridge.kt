package com.haiva.bridge

/**
 * Platform-neutral Android bridge contract.
 * The Android body owns device capabilities; H.A.I.V.A. Core owns intelligence.
 */
interface HaivaBridge {
    fun startVoiceCapture()
    fun stopVoiceCapture()
    fun speak(text: String)
    fun notify(title: String, message: String)
}
