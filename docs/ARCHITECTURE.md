# H.A.I.V.A. Architecture

## Canonical branch
`main` is the canonical H.A.I.V.A. development source. Other branches are preserved and are not modified by this architecture work.

## System layers

```text
H.A.I.V.A. / main
├── core/       Brain and engine
├── skills/     User capabilities
├── android/    Android Body
├── ui/         User interface
├── api/        Backend/API boundary
├── config/     Configuration
├── tests/      Validation
└── docs/       Architecture and roadmap
```

## Runtime relationship

```text
Android Body / Web UI
        |
        v
     Core Engine
        |
   Brain -> Router -> Skills
        |              |
      Memory          API
```

Android is the device/body layer. It must not duplicate the H.A.I.V.A. brain. Device concerns such as microphone access, audio output, notifications, permissions, and Android services belong behind the Android bridge.

## Current migration status

- Core/Brain/Router: retained as the current foundation.
- Memory: two implementations currently exist; consolidation is a planned migration, not a blind deletion.
- Voice: dedicated voice modules coexist with orchestration in `core/app.js`; dependency consolidation is required.
- Skills: current implementations remain under `core/skills` while the canonical top-level `skills/` architecture is established incrementally.
- UI: `index.html` is the active entry point; legacy UI files are not deleted until references are verified.
- Android: Body architecture has been established; implementation will be added behind the bridge without replacing the Core.
- Temporary/empty files: retain until dependency/reference verification confirms they are safe to archive or remove.
