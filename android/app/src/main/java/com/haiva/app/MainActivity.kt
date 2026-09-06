package com.haiva.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowInsets
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
    private val voiceFallbackRequestCode = 1002
    private val coreUrl = "file:///android_asset/haiva/index.html"
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var ttsReady = false
    private var pendingSpeakText: String? = null
    private var pendingNativeVoiceStart = false
    private var destroyed = false
    private var fallbackVoiceActive = false

    // Native watchdog is intentionally separate from Core voice orchestration.
    // Core owns the 3000 ms initial grace and 2000 ms post-speech silence.
    // Android owns only the bounded native request lifecycle.
    private val nativeVoiceWatchdog = Handler(Looper.getMainLooper())
    private val nativeVoiceWatchdogMs = 5000L
    private var nativeVoiceRequestActive = false

    // IMPORTANT: Android is only the native voice adapter.
    // Core/app.js is the single owner of READY -> LISTENING -> THINKING -> SPEAKING -> READY.
    // Canonical timing values are defined in core/config.js:
    // initialSpeechGraceMs = 3000, postSpeechSilenceMs = 2000.

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        textToSpeech = TextToSpeech(this, this)
        textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
            override fun onError(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
        })

        if (SpeechRecognizer.isRecognitionAvailable(this)) createSpeechRecognizer()

        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(2, 5, 11))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            textZoom = 100
        }
        webView.setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                view.setPadding(0, bars.top, 0, bars.bottom)
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
            }
            insets
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
                    } else {
                        try { request.grant(request.resources) } catch (_: Exception) {}
                    }
                }
            }
        }
        setContentView(webView)
        webView.loadUrl(coreUrl)
    }

    private fun createSpeechRecognizer() {
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply { setRecognitionListener(recognitionListener) }
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (ttsReady) {
            textToSpeech.language = Locale.US
            pendingSpeakText?.let { pendingSpeakText = null; speakNow(it) }
        }
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            cancelNativeVoiceWatchdog()
            dispatchJsEvent("haiva:native-voice-ready")
        }
        override fun onBeginningOfSpeech() {
            cancelNativeVoiceWatchdog()
            dispatchJsEvent("haiva:native-voice-begin")
        }
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { dispatchJsEvent("haiva:native-voice-end") }
        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoicePartial(text)
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onError(error: Int) {
            cancelNativeVoiceWatchdog()
            nativeVoiceRequestActive = false
            dispatchVoiceError(error)
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) createSpeechRecognizer()
        }
        override fun onResults(results: Bundle?) {
            cancelNativeVoiceWatchdog()
            nativeVoiceRequestActive = false
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoiceResult(text) else dispatchVoiceError(SpeechRecognizer.ERROR_NO_MATCH)
        }
    }

    private fun startSystemVoiceFallback() {
        if (destroyed || fallbackVoiceActive) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            dispatchVoiceUnavailable("microphone_permission_required")
            return
        }
        fallbackVoiceActive = true
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to H.A.I.V.A.")
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
        }
        try { startActivityForResult(intent, voiceFallbackRequestCode) } catch (_: Exception) {
            fallbackVoiceActive = false
            dispatchVoiceUnavailable("system_voice_fallback_unavailable")
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != voiceFallbackRequestCode) return
        fallbackVoiceActive = false
        if (resultCode != RESULT_OK) { dispatchVoiceError(SpeechRecognizer.ERROR_CLIENT); return }
        val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim().orEmpty()
        if (text.isNotEmpty()) dispatchVoiceResult(text) else dispatchVoiceError(SpeechRecognizer.ERROR_NO_MATCH)
    }

    private fun requestVoicePermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), voicePermissionRequestCode)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != voicePermissionRequestCode) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        val request = pendingWebPermissionRequest
        pendingWebPermissionRequest = null
        if (granted) {
            request?.let { try { it.grant(it.resources) } catch (_: Exception) {} }
            dispatchJsEvent("haiva:microphone-ready")
            if (pendingNativeVoiceStart) { pendingNativeVoiceStart = false; startNativeRecognition() }
        } else {
            pendingNativeVoiceStart = false
            request?.let { try { it.deny() } catch (_: Exception) {} }
            Toast.makeText(this, "Microphone permission is required for H.A.I.V.A. voice mode.", Toast.LENGTH_LONG).show()
            dispatchVoiceUnavailable("microphone_permission_denied")
        }
    }

    @JavascriptInterface
    override fun startVoiceCapture() {
        runOnUiThread {
            if (destroyed) return@runOnUiThread
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                pendingNativeVoiceStart = true
                requestVoicePermission()
                return@runOnUiThread
            }
            fallbackVoiceActive = false
            startNativeRecognition()
        }
    }

    private fun startNativeRecognition() {
        if (destroyed) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingNativeVoiceStart = true
            requestVoicePermission()
            return
        }
        if (speechRecognizer == null) {
            if (SpeechRecognizer.isRecognitionAvailable(this)) createSpeechRecognizer()
            else { dispatchVoiceUnavailable("speech_recognizer_unavailable"); return }
        }
        val recognizer = speechRecognizer ?: run {
            dispatchVoiceUnavailable("speech_recognizer_initialization_failed")
            return
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            // Canonical post-speech silence window: 2000 ms.
            // Initial 3000 ms grace is owned by core/app.js, not Android.
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
        }

        // Android is an adapter: one request in, recognition callbacks out.
        // It must never create a second orchestration loop or auto-restart itself.
        try {
            nativeVoiceRequestActive = true
            recognizer.startListening(intent)
            startNativeVoiceWatchdog()
        } catch (_: Exception) {
            nativeVoiceRequestActive = false
            startSystemVoiceFallback()
        }
    }

    private fun startNativeVoiceWatchdog() {
        cancelNativeVoiceWatchdog()
        nativeVoiceWatchdog.postDelayed({
            if (destroyed || !nativeVoiceRequestActive) return@postDelayed
            nativeVoiceRequestActive = false
            try { speechRecognizer?.cancel() } catch (_: Exception) {}
            dispatchJsEvent("haiva:native-voice-timeout")
        }, nativeVoiceWatchdogMs)
    }

    private fun cancelNativeVoiceWatchdog() {
        nativeVoiceWatchdog.removeCallbacksAndMessages(null)
    }

    @JavascriptInterface
    override fun stopVoiceCapture() {
        runOnUiThread {
            pendingNativeVoiceStart = false
            fallbackVoiceActive = false
            nativeVoiceRequestActive = false
            cancelNativeVoiceWatchdog()
            try { speechRecognizer?.stopListening() } catch (_: Exception) {}
            try { speechRecognizer?.cancel() } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    override fun speak(text: String) {
        runOnUiThread {
            val value = text.trim()
            if (destroyed || value.isEmpty()) { dispatchSpeechDone(); return@runOnUiThread }
            if (!ttsReady) { pendingSpeakText = value; return@runOnUiThread }
            speakNow(value)
        }
    }

    private fun speakNow(text: String) {
        if (destroyed || !ttsReady) return
        textToSpeech.language = Locale.US
        textToSpeech.setSpeechRate(1.0f)
        textToSpeech.setPitch(1.0f)
        val queued = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "HAIVA_RESPONSE")
        if (queued == TextToSpeech.ERROR) dispatchSpeechDone()
    }

    @JavascriptInterface
    override fun notify(title: String, message: String) {
        runOnUiThread { Toast.makeText(this, "$title: $message", Toast.LENGTH_SHORT).show() }
    }

    private fun dispatchVoicePartial(text: String) {
        val quoted = org.json.JSONObject.quote(text)
        runOnUiThread { if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-partial',{detail:{text:$quoted}}))", null) }
    }

    private fun dispatchVoiceResult(text: String) {
        val quoted = org.json.JSONObject.quote(text)
        runOnUiThread { if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-result',{detail:{text:$quoted}}))", null) }
    }

    private fun dispatchVoiceError(error: Int) {
        runOnUiThread {
            if (!destroyed) {
                val safeCode = error.toString()
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-error',{detail:{code:$safeCode}}))", null)
            }
        }
    }

    private fun dispatchVoiceUnavailable(reason: String) {
        nativeVoiceRequestActive = false
        cancelNativeVoiceWatchdog()
        val quoted = org.json.JSONObject.quote(reason)
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-unavailable',{detail:{reason:$quoted}}))", null)
        }
    }

    private fun dispatchSpeechDone() {
        runOnUiThread { if (!destroyed) dispatchJsEvent("haiva:native-speech-done") }
    }

    private fun dispatchJsEvent(name: String) {
        if (destroyed) return
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name'))", null)
    }

    override fun onDestroy() {
        destroyed = true
        pendingWebPermissionRequest?.let { try { it.deny() } catch (_: Exception) {} }
        pendingWebPermissionRequest = null
        pendingNativeVoiceStart = false
        fallbackVoiceActive = false
        nativeVoiceRequestActive = false
        cancelNativeVoiceWatchdog()
        pendingSpeakText = null
        try { speechRecognizer?.cancel() } catch (_: Exception) {}
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = null
        try { textToSpeech.stop(); textToSpeech.shutdown() } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }
}