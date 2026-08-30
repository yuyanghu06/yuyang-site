# Runtime audio

This folder contains short browser-served sound effects used by the interactive guide.

## Direct subfolders

This folder has no direct subfolders.

## Direct files

- `sans-dialogue-blip.mp3` is a 120 ms CC0 dialogue blip by OFresco from Freesound sound 520765. The agent replays it at a throttled cadence, 1.4× speed with pitch preservation disabled, and volume `0.11` while caption text streams, yielding a 40% higher pitch at half the previous volume.
- `community-crowd-talking-1m20.m4a` is the first 80 seconds of the user-provided Freesound community-crowd recording. It loops at volume `0.216` only after an individual building zoom has finished settling.
- `gamestudio-world-cloud-zoom.mp3` is the user-provided 2.168-second globe-to-Manhattan transition effect. Runtime playback peaks at `0.1` with 50 ms fades for both travel directions; it does not play for park or building zooms.
- `far-away-city-traffic-ambience.wav` is the user-provided 65-second city-traffic recording. It fades in over 1.2 seconds, loops at volume `0.27378` in the base Manhattan view, remains continuous during park zooms, rises gradually to `0.328536` as the park zoom begins, and gradually returns to the base level when zooming back out.
- `INFO.md` is this authoritative folder inventory.
