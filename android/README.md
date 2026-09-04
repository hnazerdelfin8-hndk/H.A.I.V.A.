# H.A.I.V.A. Android Body

Android is the device/body layer for H.A.I.V.A. Core.

## Responsibilities
- Android application shell
- Core bridge
- microphone and audio integration
- permissions
- notifications
- background/service integration

## Architecture rule
Android does not contain the H.A.I.V.A. brain. It connects to the canonical Core through the bridge layer.

See `docs/ARCHITECTURE.md` for the integration contract.
