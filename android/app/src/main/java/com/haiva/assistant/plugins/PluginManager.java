package com.haiva.assistant.plugins;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Central registry for optional external connectors. */
public final class PluginManager {
    private final List<Plugin> plugins = new ArrayList<>();

    public void register(Plugin plugin) {
        if (plugin == null) return;
        for (Plugin existing : plugins) {
            if (existing.id().equals(plugin.id())) return;
        }
        plugins.add(plugin);
    }

    public Plugin get(String id) {
        for (Plugin plugin : plugins) if (plugin.id().equals(id)) return plugin;
        return null;
    }

    public List<Plugin> all() { return Collections.unmodifiableList(plugins); }

    public int connectedCount() {
        int count = 0;
        for (Plugin plugin : plugins) if (plugin.isConnected()) count++;
        return count;
    }
}
