package com.haiva.assistant.tools;

import android.content.Context;
import com.haiva.assistant.memory.LocalMemory;
import java.util.Locale;

public final class ToolManager {
    private final Context context;
    private final LocalMemory memory;

    public ToolManager(Context context, LocalMemory memory) {
        this.context = context.getApplicationContext();
        this.memory = memory;
    }

    /** Returns null when the command is not a tool request. */
    public String tryExecute(String command) {
        String c = command == null ? "" : command.trim();
        String l = c.toLowerCase(Locale.US);
        if (l.startsWith("remember ")) {
            String note = c.substring("remember ".length()).trim();
            if (!note.isEmpty()) {
                memory.remember("memory", note);
                return "Remembered that, Master.";
            }
        }
        if (l.startsWith("save note ") || l.startsWith("take note ")) {
            int split = c.indexOf(' ');
            split = c.indexOf(' ', split + 1);
            String note = split >= 0 ? c.substring(split + 1).trim() : "";
            if (!note.isEmpty()) {
                memory.remember("note", note);
                return "Saved the note locally, Master.";
            }
        }
        if (l.equals("clear memory") || l.equals("forget everything")) {
            memory.clear();
            return "Local memory cleared, Master.";
        }
        return null;
    }
}
