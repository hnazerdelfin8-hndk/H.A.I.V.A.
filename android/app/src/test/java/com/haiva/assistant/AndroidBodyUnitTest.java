package com.haiva.assistant;

import com.haiva.assistant.ai.LocalAIEngine;
import com.haiva.assistant.voice.WakeWordEngine;
import org.junit.Test;
import java.util.Collections;
import static org.junit.Assert.*;

public class AndroidBodyUnitTest {
    @Test public void wakeWordIsDetected() {
        WakeWordEngine engine = new WakeWordEngine();
        assertTrue(engine.containsWakeWord("Yi, H.A.I.V.A."));
        assertTrue(engine.containsWakeWord("Hey Haiva open notes"));
        assertFalse(engine.containsWakeWord("hello assistant"));
    }

    @Test public void wakeWordCommandIsExtracted() {
        WakeWordEngine engine = new WakeWordEngine();
        assertEquals("open notes", engine.extractCommand("yo haiva open notes"));
    }

    @Test public void offlineAiHasSafeFallback() {
        LocalAIEngine engine = new LocalAIEngine();
        assertFalse(engine.hasLocalModel());
        assertTrue(engine.respond("hello", Collections.emptyList()).contains("Hello, Master"));
    }
}
