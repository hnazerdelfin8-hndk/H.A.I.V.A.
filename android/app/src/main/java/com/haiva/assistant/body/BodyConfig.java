package com.haiva.assistant.body;

/** Immutable Body-level configuration shared by lifecycle and UI wiring. */
public final class BodyConfig {
    public static final String ASSISTANT_NAME = "H.A.I.V.A.";
    public static final String USER_TITLE = "Master";
    public static final String WAKE_WORD = "yo haiva";
    public static final int MIN_ANDROID_SDK = 26;
    public static final int TARGET_ANDROID_SDK = 35;

    private BodyConfig() { }
}
