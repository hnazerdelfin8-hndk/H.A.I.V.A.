package com.haiva.assistant;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;

import com.haiva.assistant.body.BodyLifecycleController;

/** Application shell for the Android Body and owner of process-level lifecycle wiring. */
public final class HaivaApplication extends Application {
    private final BodyLifecycleController bodyLifecycle = new BodyLifecycleController();

    @Override public void onCreate() {
        super.onCreate();
        bodyLifecycle.onCreate();
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override public void onActivityStarted(Activity activity) { bodyLifecycle.onStart(); }
            @Override public void onActivityPaused(Activity activity) { bodyLifecycle.onPause(); }
            @Override public void onActivityStopped(Activity activity) { bodyLifecycle.onStop(); }
            @Override public void onActivityCreated(Activity activity, Bundle state) { }
            @Override public void onActivityResumed(Activity activity) { }
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) { }
            @Override public void onActivityDestroyed(Activity activity) { }
        });
    }

    public BodyLifecycleController bodyLifecycle() { return bodyLifecycle; }
}
