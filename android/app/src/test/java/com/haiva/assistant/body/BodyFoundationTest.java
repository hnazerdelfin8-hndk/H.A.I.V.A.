package com.haiva.assistant.body;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class BodyFoundationTest {
    @Test public void lifecycleTransitionsAreDeterministic() {
        BodyLifecycleController lifecycle = new BodyLifecycleController();
        assertEquals(BodyLifecycleController.State.STOPPED, lifecycle.state());
        lifecycle.onCreate();
        assertEquals(BodyLifecycleController.State.CREATED, lifecycle.state());
        lifecycle.onStart();
        assertTrue(lifecycle.isActive());
        lifecycle.onPause();
        assertEquals(BodyLifecycleController.State.PAUSED, lifecycle.state());
        lifecycle.onStop();
        assertFalse(lifecycle.isActive());
        assertEquals(BodyLifecycleController.State.STOPPED, lifecycle.state());
    }

    @Test public void bodyConfigurationIsStable() {
        assertEquals("H.A.I.V.A.", BodyConfig.ASSISTANT_NAME);
        assertEquals("Master", BodyConfig.USER_TITLE);
        assertEquals("yo haiva", BodyConfig.WAKE_WORD);
        assertEquals(26, BodyConfig.MIN_ANDROID_SDK);
        assertEquals(35, BodyConfig.TARGET_ANDROID_SDK);
    }
}
