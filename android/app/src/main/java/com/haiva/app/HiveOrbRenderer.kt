package com.haiva.app

import android.content.Context
import android.opengl.GLSurfaceView
import android.view.MotionEvent
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class HiveOrbRenderer(context: Context) : GLSurfaceView(context) {
    private val renderer = OrbGLRenderer()

    init {
        setEGLContextClientVersion(2)
        setRenderer(renderer)
        renderMode = RENDERMODE_CONTINUOUSLY
        setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                queueEvent { renderer.pulse() }
                true
            } else true
        }
    }

    private class OrbGLRenderer : GLSurfaceView.Renderer {
        init { System.loadLibrary("haiva_hive_orb") }
        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) = nativeInit()
        override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) = nativeResize(width, height)
        override fun onDrawFrame(gl: GL10?) = nativeRender(1f / 60f)
        fun pulse() = nativePulse()

        private external fun nativeInit()
        private external fun nativeResize(width: Int, height: Int)
        private external fun nativeRender(dt: Float)
        private external fun nativePulse()
    }
}
