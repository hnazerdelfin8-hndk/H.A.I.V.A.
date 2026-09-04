package com.haiva.app

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import com.haiva.bridge.HaivaBridge

class MainActivity : Activity(), HaivaBridge {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "H.A.I.V.A.\nCore online"
            textSize = 24f
            setPadding(32, 64, 32, 32)
        })
    }

    override fun startVoiceCapture() {}
    override fun stopVoiceCapture() {}
    override fun speak(text: String) {}
    override fun notify(title: String, message: String) {}
}
