package com.haiva.app

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Window
import android.view.WindowManager

class HiveOrbActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        setContentView(HiveOrbRenderer(this))
    }
}
