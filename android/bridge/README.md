# Android Bridge

The bridge is the boundary between Android platform capabilities and H.A.I.V.A. Core.

Planned responsibilities:
- expose device capabilities through explicit interfaces
- forward microphone/audio events to the Core voice layer
- deliver notifications and Android events to approved skills
- keep Android-specific APIs out of the Core brain

Implementation is intentionally incremental so the existing web runtime remains stable.
