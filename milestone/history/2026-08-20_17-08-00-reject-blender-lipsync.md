# Reject Blender Lip-Sync Prototype

- Rejected the custom Blender talking prototype because the mouth motion was not visibly readable.
- Root cause: the Meshy avatar supplies only a body skeleton and has no jaw bone, facial vertex weights, or facial morph targets.
- Stopped the planned ten-emotion Blender expansion so the failed facial approach is not multiplied.
- Researched current video-avatar APIs. D-ID's photo-avatar Agents/Streams path is the leading prototype candidate because it accepts a supplied image and supports browser WebRTC streaming from text or audio.
- Hedra remains a candidate for higher-quality asynchronous generated clips; Tavus is oriented toward lifelike replicas trained from video and is less aligned with the stylized avatar.
- No D-ID, Hedra, Tavus, or HeyGen credential is currently present in `.env`.
