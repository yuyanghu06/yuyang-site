# Generate clean satellite beep

- Used the OAuth-authorized ElevenLabs hosted MCP and Sound Effects v2 to generate one fresh six-second satellite telemetry candidate.
- Prompted for sparse rounded electronic beeps, subtle natural timing/pitch variation, short decay, and believable dry spacecraft hardware while explicitly excluding static, hiss, crackle, distortion, ambience, music, voices, and whooshes.
- Saved `public/audio/satellite-telemetry-beep-clean.mp3` and verified it as a six-second 44.1 kHz stereo MP3 with a -4.9 dB peak.
- The candidate is not yet wired into runtime playback.
