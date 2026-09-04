package com.haiva.assistant;

import com.haiva.assistant.voice.WakeWordEngine;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class Stage3VoiceActivationTest {
    @Test public void detectsYoHaivaWakeWord() {
        WakeWordEngine wake = new WakeWordEngine();
        assertTrue(wake.containsWakeWord("Yo, H.A.I.V.A."));
        assertEquals("", wake.extractCommand("Yo, H.A.I.V.A."));
    }

    @Test public void extractsCommandAfterWakeWord() {
        WakeWordEngine wake = new WakeWordEngine();
        assertTrue(wake.containsWakeWord("Yo, H.A.I.V.A., what is my schedule?"));
        assertEquals("what is my schedule", wake.extractCommand("Yo, H.A.I.V.A., what is my schedule?"));
    }

    @Test public void ignoresUnrelatedSpeech() {
        WakeWordEngine wake = new WakeWordEngine();
        assertFalse(wake.containsWakeWord("what is my schedule today"));
        assertEquals("", wake.extractCommand("what is my schedule today"));
    }
}
