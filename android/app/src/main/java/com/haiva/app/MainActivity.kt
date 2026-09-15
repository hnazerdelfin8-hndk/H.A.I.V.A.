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
import android.util.Log
import android.view.WindowInsets
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import com.haiva.bridge.HaivaBridge
import java.util.Locale

class MainActivity : Activity(), HaivaBridge, TextToSpeech.OnInitListener {
    private lateinit var webView: WebView
    private lateinit var textToSpeech: TextToSpeech
    private var speechRecognizer: SpeechRecognizer? = null
    private var v3SpeechRecognizer: SpeechRecognizer? = null
    private val voicePermissionRequestCode = 1001
    private val voiceFallbackRequestCode = 1002

    private val coreUrl = "https://appassets.androidplatform.net/assets/haiva/index.html"
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var ttsReady = false
    private var pendingSpeakText: String? = null
    private var pendingNativeVoiceStart = false
    private var pendingNativeV3VoiceStart = false
    private var destroyed = false
    private var fallbackVoiceActive = false

    private val nativeVoiceWatchdog = Handler(Looper.getMainLooper())
    private val nativeV3VoiceWatchdog = Handler(Looper.getMainLooper())
    private val nativeVoiceWatchdogMs = 5000L
    private var nativeVoiceRequestActive = false
    private var nativeV3VoiceRequestActive = false

    private var nativeVoiceSessionGeneration = 0L
    private var activeNativeVoiceSessionId: Long? = null
    private var nativeV3VoiceSessionGeneration = 0L
    private var activeNativeV3VoiceSessionId: Long? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        textToSpeech = TextToSpeech(this, this)
        textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
            override fun onError(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
        })

        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            createSpeechRecognizer()
            createV3SpeechRecognizer()
        }

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
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                if (request == null) return null
                return assetLoader.shouldInterceptRequest(request.url)
                    ?: super.shouldInterceptRequest(view, request)
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i("HAIVA-BOOT", "PAGE_FINISHED url=$url")
                super.onPageFinished(view, url)
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.e("HAIVA-BOOT", "RESOURCE_ERROR main=${request?.isForMainFrame} url=${request?.url} code=${error?.errorCode} desc=${error?.description}")
                super.onReceivedError(view, request, error)
            }
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                Log.e("HAIVA-BOOT", "HTTP_ERROR main=${request?.isForMainFrame} url=${request?.url} status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}")
                super.onReceivedHttpError(view, request, errorResponse)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage == null) return true
                val message = consoleMessage.message()
                val source = consoleMessage.sourceId()
                val line = consoleMessage.lineNumber()
                when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e("HAIVA-BOOT", "JS_ERROR line=$line source=$source message=$message")
                    ConsoleMessage.MessageLevel.WARNING -> Log.w("HAIVA-BOOT", "JS_WARN line=$line source=$source message=$message")
                    else -> Log.i("HAIVA-BOOT", "JS_LOG line=$line source=$source message=$message")
                }
                return true
            }
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
        Log.i("HAIVA-BOOT", "LOAD_START url=$coreUrl")
        webView.loadUrl(coreUrl)
    }

    private fun createSpeechRecognizer() {
        try { speechRecognizer?.cancel(); speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply { setRecognitionListener(recognitionListener) }
    }

    private fun createV3SpeechRecognizer() {
        try { v3SpeechRecognizer?.cancel(); v3SpeechRecognizer?.destroy() } catch (_: Exception) {}
        v3SpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply { setRecognitionListener(v3RecognitionListener) }
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
            dispatchVoiceEvent("haiva:native-voice-ready")
        }
        override fun onBeginningOfSpeech() {
            cancelNativeVoiceWatchdog()
            dispatchVoiceEvent("haiva:native-voice-begin")
        }
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { dispatchVoiceEvent("haiva:native-voice-segment-end") }
        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoicePartial(text)
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onError(error: Int) {
            cancelNativeVoiceWatchdog()
            nativeVoiceRequestActive = false
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> dispatchVoiceCaptureComplete("no_speech")
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                SpeechRecognizer.ERROR_CLIENT -> {
                    dispatchVoiceCaptureComplete("recoverable_client_state")
                    createSpeechRecognizer()
                }
                else -> dispatchVoiceError(error)
            }
        }
        override fun onResults(results: Bundle?) {
            cancelNativeVoiceWatchdog()
            nativeVoiceRequestActive = false
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoiceResult(text)
            else dispatchVoiceCaptureComplete("empty_result")
        }
    }

    private val v3RecognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            cancelNativeV3VoiceWatchdog()
            dispatchV3VoiceEvent("haiva:v3-capture-ready")
        }
        override fun onBeginningOfSpeech() {
            cancelNativeV3VoiceWatchdog()
            dispatchV3VoiceEvent("haiva:v3-capture-begin")
        }
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { dispatchV3VoiceEvent("haiva:v3-capture-segment-end") }
        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchV3VoicePartial(text)
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onError(error: Int) {
            cancelNativeV3VoiceWatchdog()
            nativeV3VoiceRequestActive = false
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> dispatchV3VoiceComplete("no_speech")
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                SpeechRecognizer.ERROR_CLIENT -> {
                    dispatchV3VoiceComplete("recoverable_client_state")
                    createV3SpeechRecognizer()
                }
                else -> dispatchV3VoiceError(error)
            }
        }
        override fun onResults(results: Bundle?) {
            cancelNativeV3VoiceWatchdog()
            nativeV3VoiceRequestActive = false
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchV3VoiceResult(text)
            else dispatchV3VoiceComplete("empty_result")
        }
    }

    private fun startSystemVoiceFallback() {
        if (destroyed || fallbackVoiceActive) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { dispatchVoiceUnavailable("microphone_permission_required"); return }
        fallbackVoiceActive = true
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to H.A.I.V.A.")
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L)
        }
        try { startActivityForResult(intent, voiceFallbackRequestCode) } catch (_: Exception) { fallbackVoiceActive = false; dispatchVoiceUnavailable("system_voice_fallback_unavailable") }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != voiceFallbackRequestCode) return
        fallbackVoiceActive = false
        if (resultCode != RESULT_OK) {
            dispatchVoiceCaptureComplete("fallback_cancelled")
            return
        }
        val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim().orEmpty()
        if (text.isNotEmpty()) dispatchVoiceResult(text) else dispatchVoiceCaptureComplete("fallback_empty_result")
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
            if (pendingNativeV3VoiceStart) { pendingNativeV3VoiceStart = false; startV3NativeRecognition() }
        } else {
            pendingNativeVoiceStart = false
            pendingNativeV3VoiceStart = false
            request?.let { try { it.deny() } catch (_: Exception) {} }
            Toast.makeText(this, "Microphone permission is required for H.A.I.V.A. voice mode.", Toast.LENGTH_LONG).show()
            dispatchVoiceUnavailable("microphone_permission_denied")
        }
    }

    @JavascriptInterface
    override fun startVoiceCapture() {
        runOnUiThread {
            if (destroyed) return@runOnUiThread
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeVoiceStart = true; requestVoicePermission(); return@runOnUiThread }
            fallbackVoiceActive = false
            startNativeRecognition()
        }
    }

    @JavascriptInterface
    override fun stopVoiceCapture() {
        runOnUiThread {
            pendingNativeVoiceStart = false
            fallbackVoiceActive = false
            nativeVoiceRequestActive = false
            activeNativeVoiceSessionId = null
            cancelNativeVoiceWatchdog()
            try { speechRecognizer?.stopListening() } catch (_: Exception) {}
            try { speechRecognizer?.cancel() } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    override fun startV3VoiceCapture() {
        runOnUiThread {
            if (destroyed) return@runOnUiThread
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeV3VoiceStart = true; requestVoicePermission(); return@runOnUiThread }
            startV3NativeRecognition()
        }
    }

    @JavascriptInterface
    override fun stopV3VoiceCapture() {
        runOnUiThread {
            pendingNativeV3VoiceStart = false
            nativeV3VoiceRequestActive = false
            activeNativeV3VoiceSessionId = null
            cancelNativeV3VoiceWatchdog()
            try { v3SpeechRecognizer?.stopListening() } catch (_: Exception) {}
            try { v3SpeechRecognizer?.cancel() } catch (_: Exception) {}
        }
    }

    private fun startNativeRecognition() {
        if (destroyed) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeVoiceStart = true; requestVoicePermission(); return }
        if (speechRecognizer == null) {
            if (SpeechRecognizer.isRecognitionAvailable(this)) createSpeechRecognizer()
            else { dispatchVoiceUnavailable("speech_recognizer_unavailable"); return }
        }
        val recognizer = speechRecognizer ?: run { dispatchVoiceUnavailable("speech_recognizer_initialization_failed"); return }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L)
        }
        val sessionId = ++nativeVoiceSessionGeneration
        activeNativeVoiceSessionId = sessionId
        try {
            nativeVoiceRequestActive = true
            recognizer.startListening(intent)
            startNativeVoiceWatchdog(sessionId)
        } catch (_: Exception) {
            nativeVoiceRequestActive = false
            activeNativeVoiceSessionId = null
            startSystemVoiceFallback()
        }
    }

    private fun startV3NativeRecognition() {
        if (destroyed) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeV3VoiceStart = true; requestVoicePermission(); return }
        if (v3SpeechRecognizer == null) {
            if (SpeechRecognizer.isRecognitionAvailable(this)) createV3SpeechRecognizer()
            else { dispatchV3VoiceError(-1); return }
        }
        val recognizer = v3SpeechRecognizer ?: run { dispatchV3VoiceError(-1); return }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 700L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
        }
        val sessionId = ++nativeV3VoiceSessionGeneration
        activeNativeV3VoiceSessionId = sessionId
        try {
            nativeV3VoiceRequestActive = true
            recognizer.startListening(intent)
            startNativeV3VoiceWatchdog(sessionId)
        } catch (_: Exception) {
            nativeV3VoiceRequestActive = false
            activeNativeV3VoiceSessionId = null
            dispatchV3VoiceError(SpeechRecognizer.ERROR_CLIENT)
        }
    }

    private fun startNativeVoiceWatchdog(sessionId: Long) {
        cancelNativeVoiceWatchdog()
        nativeVoiceWatchdog.postDelayed({
            if (destroyed || !nativeVoiceRequestActive || activeNativeVoiceSessionId != sessionId) return@postDelayed
            nativeVoiceRequestActive = false
            activeNativeVoiceSessionId = null
            try { speechRecognizer?.cancel() } catch (_: Exception) {}
            dispatchVoiceEvent("haiva:native-voice-timeout", sessionId)
        }, nativeVoiceWatchdogMs)
    }

    private fun startNativeV3VoiceWatchdog(sessionId: Long) {
        cancelNativeV3VoiceWatchdog()
        nativeV3VoiceWatchdog.postDelayed({
            if (destroyed || !nativeV3VoiceRequestActive || activeNativeV3VoiceSessionId != sessionId) return@postDelayed
            nativeV3VoiceRequestActive = false
            activeNativeV3VoiceSessionId = null
            try { v3SpeechRecognizer?.cancel() } catch (_: Exception) {}
            dispatchV3VoiceEvent("haiva:v3-capture-complete", sessionId, "timeout")
        }, nativeVoiceWatchdogMs)
    }

    private fun cancelNativeVoiceWatchdog() { nativeVoiceWatchdog.removeCallbacksAndMessages(null) }
    private fun cancelNativeV3VoiceWatchdog() { nativeV3VoiceWatchdog.removeCallbacksAndMessages(null) }

    @JavascriptInterface
    override fun speak(text: String) {
        runOnUiThread {
            val value = text.trim()
            if (destroyed || value.isEmpty()) { dispatchSpeechDone(); return@runOnUiThread }
            if (!ttsReady) { pendingSpeakText = value; return@runOnUiThread }
            speakNow(value)
        }
    }

    @JavascriptInterface
    override fun stopSpeaking() {
        runOnUiThread {
            pendingSpeakText = null
            if (!destroyed && ttsReady) {
                try { textToSpeech.stop() } catch (_: Exception) {}
            }
            dispatchSpeechDone()
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
        val sessionId = activeNativeVoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(text)
        runOnUiThread {
            if (!destroyed && activeNativeVoiceSessionId == sessionId) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-partial',{detail:{text:$quoted,sessionId:$sessionId}}))", null)
            }
        }
    }

    private fun dispatchVoiceResult(text: String) {
        val sessionId = activeNativeVoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(text)
        runOnUiThread {
            if (!destroyed && activeNativeVoiceSessionId == sessionId) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-result',{detail:{text:$quoted,sessionId:$sessionId}}))", null)
            }
        }
    }

    private fun dispatchVoiceCaptureComplete(reason: String) {
        val sessionId = activeNativeVoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(reason)
        activeNativeVoiceSessionId = null
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-complete',{detail:{reason:$quoted,sessionId:$sessionId}}))", null)
        }
    }

    private fun dispatchVoiceError(error: Int) {
        val sessionId = activeNativeVoiceSessionId ?: return
        activeNativeVoiceSessionId = null
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-error',{detail:{code:${error.toString()},sessionId:$sessionId}}))", null)
        }
    }

    private fun dispatchV3VoicePartial(text: String) {
        val sessionId = activeNativeV3VoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(text)
        runOnUiThread {
            if (!destroyed && activeNativeV3VoiceSessionId == sessionId) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:v3-capture-partial',{detail:{text:$quoted,sessionId:$sessionId}}))", null)
            }
        }
    }

    private fun dispatchV3VoiceResult(text: String) {
        val sessionId = activeNativeV3VoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(text)
        activeNativeV3VoiceSessionId = null
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:v3-capture-result',{detail:{text:$quoted,sessionId:$sessionId}}))", null)
        }
    }

    private fun dispatchV3VoiceComplete(reason: String) {
        val sessionId = activeNativeV3VoiceSessionId ?: return
        val quoted = org.json.JSONObject.quote(reason)
        activeNativeV3VoiceSessionId = null
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:v3-capture-complete',{detail:{reason:$quoted,sessionId:$sessionId}}))", null)
        }
    }

    private fun dispatchV3VoiceError(error: Int) {
        val sessionId = activeNativeV3VoiceSessionId ?: return
        activeNativeV3VoiceSessionId = null
        runOnUiThread {
            if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:v3-capture-error',{detail:{code:${error.toString()},sessionId:$sessionId}}))", null)
        }
    }

    private fun dispatchVoiceUnavailable(reason: String) {
        nativeVoiceRequestActive = false
        activeNativeVoiceSessionId = null
        cancelNativeVoiceWatchdog()
        val quoted = org.json.JSONObject.quote(reason)
        runOnUiThread { if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-unavailable',{detail:{reason:$quoted}}))", null) }
    }

    private fun dispatchVoiceEvent(name: String, sessionId: Long? = activeNativeVoiceSessionId) {
        if (destroyed || sessionId == null) return
        runOnUiThread {
            if (!destroyed && activeNativeVoiceSessionId == sessionId) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:{sessionId:$sessionId}}))", null)
            }
        }
    }

    private fun dispatchV3VoiceEvent(name: String, sessionId: Long? = activeNativeV3VoiceSessionId, reason: String? = null) {
        if (destroyed || sessionId == null) return
        val reasonJson = reason?.let { ",reason:${org.json.JSONObject.quote(it)}" } ?: ""
        runOnUiThread {
            if (!destroyed && activeNativeV3VoiceSessionId == sessionId) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:{sessionId:$sessionId$reasonJson}}))", null)
            }
        }
    }

    private fun dispatchJsEvent(name: String) {
        if (destroyed) return
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name'))", null)
    }

    private fun dispatchSpeechDone() {
        runOnUiThread { if (!destroyed) dispatchJsEvent("haiva:native-speech-done") }
    }

    override fun onDestroy() {
        destroyed = true
        pendingWebPermissionRequest?.let { try { it.deny() } catch (_: Exception) {} }
        pendingWebPermissionRequest = null
        pendingNativeVoiceStart = false
        pendingNativeV3VoiceStart = false
        fallbackVoiceActive = false
        nativeVoiceRequestActive = false
        nativeV3VoiceRequestActive = false
        activeNativeVoiceSessionId = null
        activeNativeV3VoiceSessionId = null
        cancelNativeVoiceWatchdog()
        cancelNativeV3VoiceWatchdog()
        pendingSpeakText = null
        try { speechRecognizer?.cancel() } catch (_: Exception) {}
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = null
        try { v3SpeechRecognizer?.cancel() } catch (_: Exception) {}
        try { v3SpeechRecognizer?.destroy() } catch (_: Exception) {}
        v3SpeechRecognizer = null
        try { textToSpeech.stop(); textToSpeech.shutdown() } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }
}
