package com.haiva.assistant.memory;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public final class LocalMemory {
    private static final String PREFS = "haiva_local_memory";
    private static final String KEY = "entries";
    private static final int MAX = 200;
    private final SharedPreferences prefs;

    public LocalMemory(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void remember(String role, String content) {
        String value = content == null ? "" : content.trim();
        if (value.isEmpty()) return;
        JSONArray old = read();
        JSONArray next = new JSONArray();
        int start = Math.max(0, old.length() - MAX + 1);
        try {
            for (int i = start; i < old.length(); i++) next.put(old.getJSONObject(i));
            JSONObject entry = new JSONObject();
            entry.put("role", role == null ? "unknown" : role);
            entry.put("content", value);
            entry.put("timestamp", System.currentTimeMillis());
            next.put(entry);
            prefs.edit().putString(KEY, next.toString()).apply();
        } catch (Exception ignored) { }
    }

    public synchronized List<String> recent(int limit) {
        List<String> result = new ArrayList<>();
        JSONArray data = read();
        int start = Math.max(0, data.length() - Math.max(1, limit));
        try {
            for (int i = start; i < data.length(); i++) {
                JSONObject e = data.getJSONObject(i);
                result.add(e.optString("role", "unknown") + ": " + e.optString("content", ""));
            }
        } catch (Exception ignored) { }
        return result;
    }

    public synchronized void clear() { prefs.edit().remove(KEY).apply(); }

    private JSONArray read() {
        try { return new JSONArray(prefs.getString(KEY, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }
}
