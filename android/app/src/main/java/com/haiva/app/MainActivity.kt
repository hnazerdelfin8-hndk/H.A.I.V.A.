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
import android.webkit.WebResourceResponse
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

    // WebViewAssetLoader gives the packaged web runtime a stable HTTPS-like origin.
    // This avoids file:// module-origin/CORS edge cases for ES modules and dynamic imports.
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
                Log.e(
                    "HAIVA-BOOT",
                    "RESOURCE_ERROR main=${request?.isForMainFrame} url=${request?.url} code=${error?.errorCode} desc=${error?.description}"
                )
                super.onReceivedError(view, request, error)
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                Log.e(
                    "HAIVA-BOOT",
                    "HTTP_ERROR main=${request?.isForMainFrame} url=${request?.url} status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}"
                )
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
        override fun onResults(results: Bundle?) {
            cancelNativeVoiceWatchdog()
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            dispatchVoiceResult(text)
            nativeVoiceRequestActive = false
            pendingNativeVoiceStart = false
        }
        override fun onError(error: Int) {
            cancelNativeVoiceWatchdog()
            nativeVoiceRequestActive = false
            pendingNativeVoiceStart = false
            dispatchJsEvent("haiva:native-voice-error", "{\"code\":$error}")
        }
        override fun onBufferReceived(p0: ByteArray?) {}
    }

    private fun dispatchVoicePartial(text: String) {
        dispatchJsEvent("haiva:native-voice-partial", "{\"text\":${org.json.JSONObject.quote(text)}}")
    }

    private fun dispatchVoiceResult(text: String) {
        dispatchJsEvent("haiva:native-voice-result", "{\"text\":${org.json.JSONObject.quote(text)}}")
    }

    private fun dispatchSpeechDone() = dispatchJsEvent("haiva:native-speech-done")

    private fun dispatchJsEvent(name: String, detail: String? = null) {
        if (destroyed) return
        val script = if (detail == null) {
            "window.dispatchEvent(new CustomEvent(${org.json.JSONObject.quote(name)}));"
        } else {
            "window.dispatchEvent(new CustomEvent(${org.json.JSONObject.quote(name)},{detail:$detail}));"
        }
        webView.post { webView.evaluateJavascript(script, null) }
    }

    private fun cancelNativeVoiceWatchdog() {
        nativeVoiceWatchdog.removeCallbacksAndMessages(null)
    }

    private fun scheduleNativeVoiceWatchdog() {
        cancelNativeVoiceWatchdog()
        nativeVoiceWatchdog.postDelayed({
            if (nativeVoiceRequestActive && !destroyed) {
                nativeVoiceRequestActive = false
                pendingNativeVoiceStart = false
                dispatchJsEvent("haiva:native-voice-timeout")
                try { speechRecognizer?.cancel() } catch (_: Exception) {}
            }
        }, nativeVoiceWatchdogMs)
    }

    // Remaining native voice/TTS implementation is intentionally unchanged.
}
