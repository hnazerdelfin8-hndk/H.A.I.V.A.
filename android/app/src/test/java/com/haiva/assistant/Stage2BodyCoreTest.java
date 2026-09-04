package com.haiva.assistant;

import com.haiva.assistant.body.BodyErrorHandler;
import com.haiva.assistant.body.BodyLifecycleController;
import com.haiva.assistant.body.HaivaBody;
import com.haiva.assistant.body.SystemState;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class Stage2BodyCoreTest {
    @Test public void lifecycleTransitionsAreControlled() {
        BodyLifecycleController lifecycle = new BodyLifecycleController();
        assertEquals(BodyLifecycleController.State.STOPPED, lifecycle.state());
        lifecycle.onCreate();
        assertEquals(BodyLifecycleController.State.CREATED, lifecycle.state());
        lifecycle.onStart();
        assertTrue(lifecycle.isActive());
        lifecycle.onPause();
        assertEquals(BodyLifecycleController.State.PAUSED, lifecycle.state());
        lifecycle.onStop();
        assertEquals(BodyLifecycleController.State.STOPPED, lifecycle.state());
    }

    @Test public void bodyLifecycleCanReturnToStandby() {
        HaivaBody body = new HaivaBody(null, null, null, null);
        body.start();
        assertEquals(SystemState.STANDBY, body.getState());
        body.pause();
        assertEquals(SystemState.STANDBY, body.getState());
        body.stop();
        assertEquals(SystemState.STOPPED, body.getState());
    }

    @Test public void errorsProduceControlledErrorState() {
        HaivaBody body = new HaivaBody(null, null, null, null);
        BodyErrorHandler handler = new BodyErrorHandler();
        String message = handler.handle(body, new IllegalStateException("test"));
        assertEquals(SystemState.ERROR, body.getState());
        assertTrue(message.contains("problem"));
    }
}
