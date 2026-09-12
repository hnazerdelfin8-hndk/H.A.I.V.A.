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
    private val voicePermissionRequestCode = 1001
    private val voiceFallbackRequestCode = 1002
    private val coreUrl = "https://appassets.androidplatform.net/assets/haiva/index.html"
    private val assetLoader by lazy { WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build() }

    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var ttsReady = false
    private var pendingSpeakText: String? = null
    private var pendingNativeVoiceStart: String? = null
    private var nativeVoiceSessionId: String? = null
    private var fallbackVoiceSessionId: String? = null
    private var destroyed = false
    private var fallbackVoiceActive = false
    private val nativeVoiceWatchdog = Handler(Looper.getMainLooper())
    private val nativeVoiceWatchdogMs = 5000L
    private var nativeVoiceRequestActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        textToSpeech = TextToSpeech(this, this)
        textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
            override fun onError(utteranceId: String?) { if (utteranceId == "HAIVA_RESPONSE") dispatchSpeechDone() }
        })
        if (SpeechRecognizer.isRecognitionAvailable(this)) createSpeechRecognizer(null)

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
                return assetLoader.shouldInterceptRequest(request.url) ?: super.shouldInterceptRequest(view, request)
            }
            override fun onPageFinished(view: WebView?, url: String?) { Log.i("HAIVA-BOOT", "PAGE_FINISHED url=$url"); super.onPageFinished(view, url) }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.e("HAIVA-BOOT", "RESOURCE_ERROR main=${request?.isForMainFrame} url=${request?.url} code=${error?.errorCode} desc=${error?.description}"); super.onReceivedError(view, request, error)
            }
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                Log.e("HAIVA-BOOT", "HTTP_ERROR main=${request?.isForMainFrame} url=${request?.url} status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}"); super.onReceivedHttpError(view, request, errorResponse)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage == null) return true
                when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e("HAIVA-BOOT", "JS_ERROR line=${consoleMessage.lineNumber()} source=${consoleMessage.sourceId()} message=${consoleMessage.message()}")
                    ConsoleMessage.MessageLevel.WARNING -> Log.w("HAIVA-BOOT", "JS_WARN line=${consoleMessage.lineNumber()} source=${consoleMessage.sourceId()} message=${consoleMessage.message()}")
                    else -> Log.i("HAIVA-BOOT", "JS_LOG line=${consoleMessage.lineNumber()} source=${consoleMessage.sourceId()} message=${consoleMessage.message()}")
                }
                return true
            }
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val audioRequested = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    val granted = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                    if (audioRequested && !granted) { pendingWebPermissionRequest = request; requestVoicePermission() } else try { request.grant(request.resources) } catch (_: Exception) {}
                }
            }
        }
        setContentView(webView)
        Log.i("HAIVA-BOOT", "LOAD_START url=$coreUrl")
        webView.loadUrl(coreUrl)
    }

    private fun createSpeechRecognizer(sessionId: String?) {
        try { speechRecognizer?.cancel(); speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply { setRecognitionListener(recognitionListener) }
        if (sessionId != null) nativeVoiceSessionId = sessionId
    }

    private fun current(sessionId: String?): Boolean = !destroyed && sessionId != null && sessionId == nativeVoiceSessionId
    private fun currentFallback(sessionId: String?): Boolean = !destroyed && sessionId != null && sessionId == fallbackVoiceSessionId

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (ttsReady) { textToSpeech.language = Locale.US; pendingSpeakText?.let { pendingSpeakText = null; speakNow(it) } }
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            val sessionId = nativeVoiceSessionId ?: return
            cancelNativeVoiceWatchdog(sessionId)
            if (current(sessionId)) dispatchJsEvent("haiva:native-voice-ready", sessionId)
        }
        override fun onBeginningOfSpeech() {
            val sessionId = nativeVoiceSessionId ?: return
            cancelNativeVoiceWatchdog(sessionId)
            if (current(sessionId)) dispatchJsEvent("haiva:native-voice-begin", sessionId)
        }
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {
            val sessionId = nativeVoiceSessionId ?: return
            if (current(sessionId)) dispatchJsEvent("haiva:native-voice-segment-end", sessionId)
        }
        override fun onPartialResults(partialResults: Bundle?) {
            val sessionId = nativeVoiceSessionId ?: return
            if (!current(sessionId)) return
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoicePartial(text, sessionId)
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onError(error: Int) {
            val sessionId = nativeVoiceSessionId ?: return
            if (!current(sessionId)) return
            cancelNativeVoiceWatchdog(sessionId)
            nativeVoiceRequestActive = false
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> dispatchVoiceCaptureComplete("no_speech", sessionId)
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_CLIENT -> { dispatchVoiceRecoverable(error, sessionId); createSpeechRecognizer(null) }
                else -> dispatchVoiceError(error, sessionId)
            }
        }
        override fun onResults(results: Bundle?) {
            val sessionId = nativeVoiceSessionId ?: return
            if (!current(sessionId)) return
            cancelNativeVoiceWatchdog(sessionId)
            nativeVoiceRequestActive = false
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) dispatchVoiceResult(text, sessionId) else dispatchVoiceCaptureComplete("empty_result", sessionId)
        }
    }

    private fun startSystemVoiceFallback(sessionId: String) {
        if (destroyed || fallbackVoiceActive) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { dispatchVoiceUnavailable("microphone_permission_required", sessionId); return }
        fallbackVoiceActive = true
        fallbackVoiceSessionId = sessionId
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
        try { startActivityForResult(intent, voiceFallbackRequestCode) } catch (_: Exception) { fallbackVoiceActive = false; fallbackVoiceSessionId = null; dispatchVoiceUnavailable("system_voice_fallback_unavailable", sessionId) }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != voiceFallbackRequestCode) return
        val sessionId = fallbackVoiceSessionId
        fallbackVoiceActive = false
        fallbackVoiceSessionId = null
        if (!currentFallback(sessionId) && sessionId != nativeVoiceSessionId) return
        if (resultCode != RESULT_OK) { dispatchVoiceCaptureComplete("fallback_cancelled", sessionId ?: return); return }
        val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim().orEmpty()
        if (text.isNotEmpty()) dispatchVoiceResult(text, sessionId ?: return) else dispatchVoiceCaptureComplete("fallback_empty_result", sessionId ?: return)
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
        val sessionId = pendingNativeVoiceStart
        pendingNativeVoiceStart = null
        if (granted) {
            request?.let { try { it.grant(it.resources) } catch (_: Exception) {} }
            dispatchJsEvent("haiva:microphone-ready", sessionId)
            if (sessionId != null) startNativeRecognition(sessionId)
        } else {
            request?.let { try { it.deny() } catch (_: Exception) {} }
            Toast.makeText(this, "Microphone permission is required for H.A.I.V.A. voice mode.", Toast.LENGTH_LONG).show()
            if (sessionId != null) dispatchVoiceUnavailable("microphone_permission_denied", sessionId)
        }
    }

    @JavascriptInterface
    override fun startVoiceCapture(sessionId: String) {
        runOnUiThread {
            if (destroyed) return@runOnUiThread
            nativeVoiceSessionId = sessionId
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeVoiceStart = sessionId; requestVoicePermission(); return@runOnUiThread }
            fallbackVoiceActive = false
            fallbackVoiceSessionId = null
            startNativeRecognition(sessionId)
        }
    }

    private fun startNativeRecognition(sessionId: String) {
        if (destroyed || !current(sessionId)) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { pendingNativeVoiceStart = sessionId; requestVoicePermission(); return }
        if (speechRecognizer == null) {
            if (SpeechRecognizer.isRecognitionAvailable(this)) createSpeechRecognizer(sessionId) else { dispatchVoiceUnavailable("speech_recognizer_unavailable", sessionId); return }
        }
        val recognizer = speechRecognizer ?: run { dispatchVoiceUnavailable("speech_recognizer_initialization_failed", sessionId); return }
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
        try { nativeVoiceRequestActive = true; nativeVoiceSessionId = sessionId; recognizer.startListening(intent); startNativeVoiceWatchdog(sessionId) }
        catch (_: Exception) { nativeVoiceRequestActive = false; startSystemVoiceFallback(sessionId) }
    }

    private fun startNativeVoiceWatchdog(sessionId: String) {
        cancelNativeVoiceWatchdog(null)
        nativeVoiceWatchdog.postDelayed({
            if (!current(sessionId) || !nativeVoiceRequestActive) return@postDelayed
            nativeVoiceRequestActive = false
            try { speechRecognizer?.cancel() } catch (_: Exception) {}
            dispatchJsEvent("haiva:native-voice-timeout", sessionId)
        }, nativeVoiceWatchdogMs)
    }
    private fun cancelNativeVoiceWatchdog(sessionId: String?) { nativeVoiceWatchdog.removeCallbacksAndMessages(null) }

    @JavascriptInterface
    override fun stopVoiceCapture(sessionId: String) {
        runOnUiThread {
            if (sessionId == nativeVoiceSessionId) nativeVoiceSessionId = null
            if (sessionId == pendingNativeVoiceStart) pendingNativeVoiceStart = null
            if (sessionId == fallbackVoiceSessionId) fallbackVoiceSessionId = null
            fallbackVoiceActive = false
            nativeVoiceRequestActive = false
            cancelNativeVoiceWatchdog(sessionId)
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
    @JavascriptInterface
    override fun stopSpeaking() {
        runOnUiThread {
            pendingSpeakText = null
            if (!destroyed && ttsReady) try { textToSpeech.stop() } catch (_: Exception) {}
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
    override fun notify(title: String, message: String) { runOnUiThread { Toast.makeText(this, "$title: $message", Toast.LENGTH_SHORT).show() } }

    private fun dispatchVoicePartial(text: String, sessionId: String) = dispatchVoiceTextEvent("haiva:native-voice-partial", text, sessionId)
    private fun dispatchVoiceResult(text: String, sessionId: String) = dispatchVoiceTextEvent("haiva:native-voice-result", text, sessionId)
    private fun dispatchVoiceTextEvent(name: String, text: String, sessionId: String) {
        val quoted = org.json.JSONObject.quote(text)
        val session = org.json.JSONObject.quote(sessionId)
        runOnUiThread { if (!destroyed && current(sessionId)) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:{text:$quoted,sessionId:$session}}))", null) }
    }
    private fun dispatchVoiceCaptureComplete(reason: String, sessionId: String) {
        val quoted = org.json.JSONObject.quote(reason)
        val session = org.json.JSONObject.quote(sessionId)
        runOnUiThread { if (!destroyed && current(sessionId)) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-complete',{detail:{reason:$quoted,sessionId:$session}}))", null) }
    }
    private fun dispatchVoiceRecoverable(error: Int, sessionId: String) {
        val session = org.json.JSONObject.quote(sessionId)
        runOnUiThread { if (!destroyed && current(sessionId)) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-recoverable',{detail:{code:${error},sessionId:$session}}))", null) }
    }
    private fun dispatchVoiceError(error: Int, sessionId: String) {
        val session = org.json.JSONObject.quote(sessionId)
        runOnUiThread { if (!destroyed && current(sessionId)) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-error',{detail:{code:${error},sessionId:$session}}))", null) }
    }
    private fun dispatchVoiceUnavailable(reason: String, sessionId: String?) {
        nativeVoiceRequestActive = false
        cancelNativeVoiceWatchdog(sessionId)
        val quoted = org.json.JSONObject.quote(reason)
        val session = sessionId?.let { org.json.JSONObject.quote(it) }
        val detail = if (session != null) "{reason:$quoted,sessionId:$session}" else "{reason:$quoted}"
        runOnUiThread { if (!destroyed) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('haiva:native-voice-unavailable',{detail:$detail}))", null) }
    }
    private fun dispatchSpeechDone() { runOnUiThread { if (!destroyed) dispatchJsEvent("haiva:native-speech-done", null) } }
    private fun dispatchJsEvent(name: String, sessionId: String?) {
        if (destroyed) return
        val detail = sessionId?.let { "{sessionId:${org.json.JSONObject.quote(it)}}" } ?: "{}"
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:$detail}))", null)
    }

    override fun onDestroy() {
        destroyed = true
        pendingWebPermissionRequest?.let { try { it.deny() } catch (_: Exception) {} }
        pendingWebPermissionRequest = null
        pendingNativeVoiceStart = null
        nativeVoiceSessionId = null
        fallbackVoiceSessionId = null
        fallbackVoiceActive = false
        nativeVoiceRequestActive = false
        cancelNativeVoiceWatchdog(null)
        pendingSpeakText = null
        try { speechRecognizer?.cancel() } catch (_: Exception) {}
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = null
        try { textToSpeech.stop(); textToSpeech.shutdown() } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }
}
