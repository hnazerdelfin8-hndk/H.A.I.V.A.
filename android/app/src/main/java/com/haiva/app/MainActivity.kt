package com.haiva.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.haiva.bridge.HaivaBridge
import java.util.Locale

class MainActivity : Activity(), HaivaBridge, TextToSpeech.OnInitListener {
    private lateinit var webView: WebView
    private lateinit var textToSpeech: TextToSpeech
    private var speechRecognizer: SpeechRecognizer? = null
    private val voicePermissionRequestCode = 1001
    private val coreUrl = "file:///android_asset/haiva/index.html"
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        textToSpeech = TextToSpeech(this, this)
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(recognitionListener)
            }
        }

        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.addJavascriptInterface(this, "HaivaBridge")
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val audioRequested = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    val microphoneGranted = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                    if (audioRequested && !microphoneGranted) {
                        pendingWebPermissionRequest = request
                        requestVoicePermission()
                    } else request.grant(request.resources)
                }
            }
        }

        setContentView(webView)
        webView.loadUrl(coreUrl)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestVoicePermission()
        }
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (ttsReady) textToSpeech.language = Locale.US
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onPartialResults(partialResults: Bundle?) {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onError(error: Int) { dispatchVoiceError(error) }
        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoiceResult(text)
        }
    }

    private fun requestVoicePermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), voicePermissionRequestCode)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != voicePermissionRequestCode) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        val request = pendingWebPermissionRequest
        pendingWebPermissionRequest = null
        if (granted) {
            request?.let { try { it.grant(it.resources) } catch (_: Exception) {} }
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:microphone-ready'))", null)
        } else {
            request?.deny()
            Toast.makeText(this, "Microphone permission is required for H.A.I.V.A. voice mode.", Toast.LENGTH_LONG).show()
        }
    }

    @JavascriptInterface
    override fun startVoiceCapture() {
        runOnUiThread {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestVoicePermission()
                return@runOnUiThread
            }
            val recognizer = speechRecognizer ?: run {
                dispatchVoiceError(SpeechRecognizer.ERROR_CLIENT)
                return@runOnUiThread
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US.toLanguageTag())
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            }
            try { recognizer.startListening(intent) } catch (_: Exception) { dispatchVoiceError(SpeechRecognizer.ERROR_CLIENT) }
        }
    }

    @JavascriptInterface
    override fun stopVoiceCapture() {
        runOnUiThread { try { speechRecognizer?.stopListening() } catch (_: Exception) {} }
    }

    @JavascriptInterface
    override fun speak(text: String) {
        runOnUiThread {
            if (!ttsReady) {
                dispatchSpeechDone()
                return@runOnUiThread
            }
            textToSpeech.language = Locale.US
            textToSpeech.setSpeechRate(1.0f)
            textToSpeech.setPitch(1.0f)
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "HAIVA_RESPONSE")
        }
    }

    @JavascriptInterface
    override fun notify(title: String, message: String) {
        runOnUiThread { Toast.makeText(this, "$title: $message", Toast.LENGTH_SHORT).show() }
    }

    private fun dispatchVoiceResult(text: String) {
        val quoted = org.json.JSONObject.quote(text)
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-result',{detail:{text:$quoted}}))", null)
    }

    private fun dispatchVoiceError(error: Int) {
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-error',{detail:{code:$error}}))", null)
    }

    private fun dispatchSpeechDone() {
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-speech-done'))", null)
    }

    override fun onDestroy() {
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = null
        try { textToSpeech.stop(); textToSpeech.shutdown() } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }
}
