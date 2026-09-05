package com.haiva.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.provider.Settings
import org.json.JSONObject

/** Controlled, deterministic device capabilities exposed through the H.A.I.V.A. bridge. */
class PhoneCapabilities(private val context: Context) {
    private val packageMap = mapOf(
        "youtube" to "com.google.android.youtube",
        "chrome" to "com.android.chrome",
        "gmail" to "com.google.android.gm",
        "maps" to "com.google.android.apps.maps",
        "spotify" to "com.spotify.music"
    )

    fun battery(): String {
        val manager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return JSONObject().put("success", level >= 0).put("level", level).toString()
    }

    fun deviceInfo(): String = JSONObject()
        .put("success", true)
        .put("manufacturer", android.os.Build.MANUFACTURER)
        .put("model", android.os.Build.MODEL)
        .put("androidVersion", android.os.Build.VERSION.RELEASE)
        .put("sdk", android.os.Build.VERSION.SDK_INT)
        .toString()

    fun openApp(name: String): String {
        val key = name.trim().lowercase()
        val packageName = packageMap[key]
            ?: return JSONObject().put("success", false).put("error", "Unsupported app: $key").toString()
        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return JSONObject().put("success", false).put("error", "App not installed: $key").toString()
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return JSONObject().put("success", true).put("app", key).toString()
    }

    fun settings(): String = JSONObject()
        .put("success", true)
        .put("action", "settings")
        .toString()
}
