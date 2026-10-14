# Runtime audio

This folder contains short browser-served sound effects used by the interactive guide.

## Direct subfolders

This folder has no direct subfolders.

## Direct files

- `background-416-chiptune.mp3` is the user-provided 4:16 8-bit instrumental by Nick Panek. It is the first track in the experience-gated background playlist and plays at the shared low background level of `0.06`.
- `background-platform-shoes.mp3` is the user-provided 2:43 8-bit instrumental by Nick Panek and is the second background-playlist track.
- `background-pixel-dreams.mp3` is the user-provided 2:48 Pixel Dreams instrumental and is the third background-playlist track.
- `background-exploration-chiptune.mp3` is the user-provided 3:45 RPG exploration instrumental by Nick Panek and is the fourth background-playlist track before the sequence wraps.
- `sans-dialogue-blip.mp3` is a 120 ms CC0 dialogue blip by OFresco from Freesound sound 520765. The agent replays it at a throttled cadence, 1.4× speed with pitch preservation disabled, and volume `0.11` while caption text streams, yielding a 40% higher pitch at half the previous volume.
- `community-crowd-talking-1m20.m4a` is the first 80 seconds of the user-provided Freesound community-crowd recording. It loops at volume `0.216` only after an individual building zoom has finished settling, using the shared 250 ms exponential fade in/out.
- `vons-shopping-mall-ambience.mp3` derives from the supplied Gregor Quendel shopping-mall recording with an 11.4 dB attenuation, matching the crowd recording's approximately -18.1 dBFS decoded peak. Vons shares the Torrey Highlands Plaza camera, where this loop replaces the crowd effect at the same `0`–`0.216` volume range and 250 ms fades after camera settlement.
- `san-diego-suburban-birds.mp3` derives from the supplied 302.376-second suburban-birds recording with 20.2 dB attenuation to match the traffic effect's approximately -20.9 dBFS peak. The last and first 1.2 seconds are crossfaded and rotated into a continuous 301.176-second loop. It replaces traffic in the San Diego overview, using the existing `0.328536` ambience level and 1.2-second entry/exit fades; school and plaza closeups fade it out.
- `gamestudio-world-cloud-zoom.mp3` is the user-provided 2.168-second globe-to-Manhattan transition effect. Runtime playback peaks at `0.1` with shared 200 ms exponential fades at both ends; it does not play for park or building zooms.
- `far-away-city-traffic-ambience.wav` is the user-provided 65-second city-traffic recording. It uses the shared 1.2-second exponential transition, loops at volume `0.27378` in the base Manhattan view, remains continuous during park zooms, rises to `0.328536` as the park zoom begins, and returns to the base level when zooming back out.
- `INFO.md` is this authoritative folder inventory.

The four background tracks begin only after the user's experience-start gesture, continue across all geographic and landmark views, and transition with the shared three-second exponential crossfade. Source files remain at their supplied encoding; their quieter presentation is controlled non-destructively at runtime.
