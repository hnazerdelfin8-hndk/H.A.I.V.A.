package com.haiva.app

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.webkit.WebView
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Native speech-onset monitor used only while H.A.I.V.A. TTS is speaking.
 *
 * It does not perform transcription. It listens for human speech onset using
 * AudioRecord and platform preprocessing (AEC/NS/AGC when available), then
 * notifies the WebView so the duplex controller can stop TTS and hand the mic to the normal ASR turn.
 */
object DuplexAudioMonitor {
    private const val SAMPLE_RATE = 16000
    private const val FRAME_MS = 20
    private const val FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS / 1000
    private const val CALIBRATION_FRAMES = 12
    private const val SPEECH_MARGIN_DB = 9.0
    private const val REQUIRED_SPEECH_FRAMES = 2

    private val running = AtomicBoolean(false)
    @Volatile private var worker: Thread? = null
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var aec: AcousticEchoCanceler? = null
    @Volatile private var ns: NoiseSuppressor? = null
    @Volatile private var agc: AutomaticGainControl? = null

    fun start(activity: Activity, turn: Long): Boolean {
        if (activity.isFinishing || activity.isDestroyed) return false
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return false
        if (!running.compareAndSet(false, true)) return true

        worker = Thread({ monitorLoop(activity, turn) }, "haiva-duplex-vad").apply {
            isDaemon = true
            start()
        }
        return true
    }

    fun stop() {
        if (!running.getAndSet(false)) return
        try { recorder?.stop() } catch (_: Exception) {}
        try { recorder?.release() } catch (_: Exception) {}
        recorder = null
        try { aec?.release() } catch (_: Exception) {}
        try { ns?.release() } catch (_: Exception) {}
        try { agc?.release() } catch (_: Exception) {}
        aec = null
        ns = null
        agc = null
        worker = null
    }

    private fun monitorLoop(activity: Activity, turn: Long) {
        var localRecorder: AudioRecord? = null
        try {
            val minBuffer = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            if (minBuffer <= 0) {
                dispatch(activity, "haiva:duplex-error", mapOf("reason" to "invalid_buffer"))
                return
            }

            val bufferBytes = maxOf(minBuffer, FRAME_SAMPLES * 2 * 4)
            localRecorder = AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferBytes)
                .apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) setPrivacySensitive(false)
                }
                .build()

            if (localRecorder.state != AudioRecord.STATE_INITIALIZED) {
                dispatch(activity, "haiva:duplex-error", mapOf("reason" to "audio_record_uninitialized"))
                return
            }

            recorder = localRecorder
            val sessionId = localRecorder.audioSessionId
            if (AcousticEchoCanceler.isAvailable()) {
                aec = AcousticEchoCanceler.create(sessionId)?.also { effect ->
                    try { effect.enabled = true } catch (_: Exception) {}
                }
            }
            if (NoiseSuppressor.isAvailable()) {
                ns = NoiseSuppressor.create(sessionId)?.also { effect ->
                    try { effect.enabled = true } catch (_: Exception) {}
                }
            }
            if (AutomaticGainControl.isAvailable()) {
                agc = AutomaticGainControl.create(sessionId)?.also { effect ->
                    try { effect.enabled = true } catch (_: Exception) {}
                }
            }

            localRecorder.startRecording()
            dispatch(activity, "haiva:duplex-ready", mapOf("turn" to turn))

            val samples = ShortArray(FRAME_SAMPLES)
            var noiseDb = -55.0
            var calibrationSum = 0.0
            var calibrationCount = 0
            var speechFrames = 0

            while (running.get()) {
                val read = localRecorder.read(samples, 0, samples.size)
                if (read <= 0) continue

                val db = rmsDb(samples, read)
                if (calibrationCount < CALIBRATION_FRAMES) {
                    calibrationSum += db
                    calibrationCount++
                    noiseDb = calibrationSum / calibrationCount
                    continue
                }

                if (db < noiseDb + 3.0) noiseDb = (noiseDb * 0.92) + (db * 0.08)

                if (db >= noiseDb + SPEECH_MARGIN_DB) {
                    speechFrames++
                    if (speechFrames >= REQUIRED_SPEECH_FRAMES) {
                        running.set(false)
                        dispatch(
                            activity,
                            "haiva:duplex-barge-in",
                            mapOf("turn" to turn, "source" to "native-duplex-vad")
                        )
                        break
                    }
                } else {
                    speechFrames = 0
                }
            }
        } catch (_: SecurityException) {
            dispatch(activity, "haiva:duplex-error", mapOf("reason" to "microphone_permission"))
        } catch (error: Exception) {
            dispatch(activity, "haiva:duplex-error", mapOf("reason" to (error.message ?: "audio_monitor_error")))
        } finally {
            cleanupRecorder(localRecorder)
        }
    }

    private fun cleanupRecorder(localRecorder: AudioRecord?) {
        try { localRecorder?.stop() } catch (_: Exception) {}
        try { localRecorder?.release() } catch (_: Exception) {}
        if (recorder === localRecorder) recorder = null
        try { aec?.release() } catch (_: Exception) {}
        try { ns?.release() } catch (_: Exception) {}
        try { agc?.release() } catch (_: Exception) {}
        aec = null
        ns = null
        agc = null
        running.set(false)
        worker = null
    }

    private fun rmsDb(samples: ShortArray, count: Int): Double {
        var sum = 0.0
        for (i in 0 until count) {
            val value = samples[i].toDouble() / Short.MAX_VALUE.toDouble()
            sum += value * value
        }
        val rms = sqrt(sum / count.coerceAtLeast(1))
        return 20.0 * log10(rms.coerceAtLeast(1e-7))
    }

    private fun dispatch(activity: Activity, eventName: String, detail: Map<String, Any>) {
        activity.runOnUiThread {
            if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
            val root = activity.findViewById<android.view.View>(android.R.id.content) ?: return@runOnUiThread
            val webView = findWebView(root) ?: return@runOnUiThread
            val json = JSONObject()
            detail.forEach { (key, value) -> json.put(key, value) }
            val script = "window.dispatchEvent(new CustomEvent(${JSONObject.quote(eventName)},{detail:${json}}))"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun findWebView(view: android.view.View): WebView? {
        if (view is WebView) return view
        if (view is android.view.ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }
}
