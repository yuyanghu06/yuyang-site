# Stream dialogue audio

- Added the CC0 OFresco Sans-style dialogue blip under `public/audio/` and trigger it during scripted and OpenAI text streaming.
- Added a server `speech_start` event at the first model output message so reply audio begins before the first text delta.
- Set playback to 1.4× with pitch preservation disabled, volume `0.11`, and a 58 ms cadence.
- The automatic first greeting remains subject to browser autoplay policy until user activation.
