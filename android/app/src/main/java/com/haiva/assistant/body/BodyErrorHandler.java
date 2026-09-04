package com.haiva.assistant.body;

/** Converts runtime failures into a controlled Body error state and safe user message. */
public final class BodyErrorHandler {
    public String handle(HaivaBody body, Exception error) {
        if (body != null) body.setState(SystemState.ERROR);
        return "I hit a problem while processing that, Master. Please try again.";
    }
}
