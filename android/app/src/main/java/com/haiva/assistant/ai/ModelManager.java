package com.haiva.assistant.ai;

import android.content.Context;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class ModelManager {
    private final Context context;
    public ModelManager(Context context) { this.context = context.getApplicationContext(); }

    public List<String> availableLocalModels() {
        List<String> models = new ArrayList<>();
        try {
            String[] files = context.getAssets().list("models/llm");
            if (files != null) for (String file : files) models.add(file);
        } catch (IOException ignored) { }
        return models;
    }

    public boolean hasPackagedLLM() { return !availableLocalModels().isEmpty(); }
}
