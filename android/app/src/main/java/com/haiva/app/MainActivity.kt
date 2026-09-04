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
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import com.haiva.bridge.HaivaBridge
import java.util.Locale

class MainActivity : Activity(), HaivaBridge {
    private lateinit var webView: WebView
    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var pendingSpeechStart = false

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        textToSpeech = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.language = Locale.US
                textToSpeech?.setSpeechRate(0.92f)
            }
        }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url) ?: super.shouldInterceptRequest(view, request)
                }
            }
            addJavascriptInterface(this@MainActivity, "HAIVA_ANDROID")
            loadUrl("https://appassets.androidplatform.net/assets/index.html")
        }

        setContentView(webView)
    }

    @JavascriptInterface
    override fun startVoiceCapture() {
        runOnUiThread {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                pendingSpeechStart = true
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
                return@runOnUiThread
            }
            startNativeRecognition()
        }
    }

    @JavascriptInterface
    override fun stopVoiceCapture() {
        runOnUiThread {
            pendingSpeechStart = false
            speechRecognizer?.cancel()
        }
    }

    @JavascriptInterface
    override fun speak(text: String) {
        runOnUiThread {
            val utterance = text.trim()
            if (utterance.isEmpty()) {
                notifySpeechDone()
                return@runOnUiThread
            }
            textToSpeech?.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit
                override fun onDone(utteranceId: String?) = notifySpeechDone()
                override fun onError(utteranceId: String?) = notifySpeechDone()
            })
            textToSpeech?.speak(utterance, TextToSpeech.QUEUE_FLUSH, null, "haiva-response")
        }
    }

    @JavascriptInterface
    override fun notify(title: String, message: String) {
        runOnUiThread {
            Toast.makeText(this, "$title: $message", Toast.LENGTH_SHORT).show()
        }
    }

    private fun startNativeRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            webView.evaluateJavascript("window.haivaNativeError('unavailable')", null)
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    webView.evaluateJavascript("window.haivaNativeStart()", null)
                }
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onPartialResults(partialResults: Bundle?) {
                    val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    sendNativeResult(text, false)
                }
                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                    if (text.isNotBlank()) sendNativeResult(text, true)
                    webView.evaluateJavascript("window.haivaNativeEnd()", null)
                }
                override fun onError(error: Int) {
                    webView.evaluateJavascript("window.haivaNativeError('$error')", null)
                    webView.evaluateJavascript("window.haivaNativeEnd()", null)
                }
                override fun onEvent(eventType: Int, params: Bundle?) = Unit
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        speechRecognizer?.startListening(intent)
    }

    private fun sendNativeResult(text: String, isFinal: Boolean) {
        val escaped = org.json.JSONObject.quote(text)
        webView.evaluateJavascript("window.haivaNativeResult($escaped,$isFinal)", null)
    }

    private fun notifySpeechDone() {
        webView.evaluateJavascript("window.haivaNativeSpeechDone()", null)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_AUDIO) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && pendingSpeechStart) {
                pendingSpeechStart = false
                startNativeRecognition()
            } else {
                pendingSpeechStart = false
                webView.evaluateJavascript("window.haivaNativeError('not-allowed')", null)
            }
        }
    }

    override fun onDestroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_AUDIO = 4101
    }
}
