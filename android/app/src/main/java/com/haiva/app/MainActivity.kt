package com.haiva.app

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.haiva.bridge.HaivaBridge

class MainActivity : Activity(), HaivaBridge {
    private lateinit var webView: WebView
    private val voicePermissionRequestCode = 1001
    private val coreUrl = "file:///android_asset/haiva/index.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val audioRequested = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    if (audioRequested && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        requestVoicePermission()
                        request.cancel()
                    } else {
                        request.grant(request.resources)
                    }
                }
            }
        }
        setContentView(webView)
        webView.loadUrl(coreUrl)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestVoicePermission()
        }
    }

    private fun requestVoicePermission() {
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), voicePermissionRequestCode)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == voicePermissionRequestCode && grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Microphone permission is required for H.A.I.V.A. voice mode.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    override fun startVoiceCapture() {}
    override fun stopVoiceCapture() {}
    override fun speak(text: String) {}
    override fun notify(title: String, message: String) {}
}
