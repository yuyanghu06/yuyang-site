# Runtime audio

This folder contains browser-served sound effects and background music used by the interactive guide, plus their retained original recordings.

## Direct subfolders

This folder has no direct subfolders.

## Direct files

- `background-416-chiptune.mp3` retains the user-provided 4:16 8-bit instrumental by Nick Panek as the original recording; runtime playback uses its AAC derivative.
- `background-416-chiptune.m4a` is the 128 kbps AAC runtime derivative of that original. It is the first track in the experience-gated background playlist and plays at the shared low background level of `0.06`.
- `background-platform-shoes.mp3` retains the user-provided 2:43 8-bit instrumental by Nick Panek as the original recording.
- `background-platform-shoes.m4a` is its 128 kbps AAC runtime derivative and the second background-playlist track.
- `background-pixel-dreams.mp3` retains the user-provided 2:48 Pixel Dreams instrumental as the original recording.
- `background-pixel-dreams.m4a` is its 128 kbps AAC runtime derivative and the third background-playlist track.
- `background-exploration-chiptune.mp3` retains the user-provided 3:45 RPG exploration instrumental by Nick Panek as the original recording.
- `background-exploration-chiptune.m4a` is its 128 kbps AAC runtime derivative and the fourth background-playlist track before the sequence wraps.
- `sans-dialogue-blip.mp3` is a 120 ms CC0 dialogue blip by OFresco from Freesound sound 520765. The agent replays it at a throttled cadence, 1.4× speed with pitch preservation disabled, and volume `0.11` while caption text streams, yielding a 40% higher pitch at half the previous volume.
- `community-crowd-talking-1m20.m4a` is the first 80 seconds of the user-provided Freesound community-crowd recording. It loops at volume `0.216` only after an individual building zoom has finished settling, using the shared 250 ms exponential fade in/out.
- `vons-shopping-mall-ambience.mp3` derives from the supplied Gregor Quendel shopping-mall recording with an 11.4 dB attenuation, matching the crowd recording's approximately -18.1 dBFS decoded peak. The 1,359,765-byte recording loads only on the first settled Torrey Highlands Plaza visit, after the camera locks and both camera and globe transitions finish. Vons shares that plaza camera, where this loop replaces the crowd effect at the same `0`–`0.216` volume range and 250 ms fades. Later visits reuse the assigned source.
- `san-diego-suburban-birds.mp3` derives from the supplied 302.376-second suburban-birds recording with 20.2 dB attenuation to match the traffic effect's approximately -20.9 dBFS peak. The last and first 1.2 seconds are crossfaded and rotated into a continuous 301.176-second loop. The 3,979,101-byte recording loads only when the first activated San Diego view settles with an unlocked camera and both camera and globe transitions finished, keeping its download out of city geometry preparation. It replaces traffic in San Diego unlocked views, using the existing `0.328536` ambience level and 1.2-second entry/exit fades; school and plaza closeups fade it out. Revisits reuse the assigned source.
- `gamestudio-world-cloud-zoom.mp3` is the user-provided 2.168-second globe-to-Manhattan transition effect. Runtime playback peaks at `0.1` with shared 200 ms exponential fades at both ends; it does not play for park or building zooms.
- `gamestudio-world-cloud-zoom-reverse.wav` retains the earlier reverse-transition recording for recovery; the current controller does not load it.
- `far-away-city-traffic-ambience.wav` retains the user-provided 65.472021-second city-traffic recording as the original source; the current controller does not load it.
- `far-away-city-traffic-ambience.m4a` is its 128 kbps AAC runtime derivative. It uses the shared 1.2-second exponential transition, loops at volume `0.27378` in the base Manhattan view, remains continuous during park zooms, rises to `0.328536` as the park zoom begins, and returns to the base level when zooming back out.
- `INFO.md` is this authoritative folder inventory.

All map audio elements start without a source and with `preload="none"`. The experience gate plus actual browser user activation or the existing CTA audio-priming call allow playback; the development loader bypass alone does not trigger downloads. New York traffic and settled-landmark crowd recordings acquire a source only when their view needs playback. San Diego geometry preparation starts neither birds nor mall downloads. Birds wait until the first unlocked San Diego camera settles, and the mall recording stays unloaded through the overview, other districts and schools, and the approach to the plaza until that camera has settled and locked. Both retain the existing transition and activation gates. The zoom sound loads on the first actual globe transition. Stopping an unused dialogue blip does not construct an audio element.

The playlist assigns only the active track initially, prepares its successor twelve seconds before the current track ends, and starts the shared three-second exponential crossfade once successor playback begins. This keeps the outgoing track audible during a delayed or failed successor start. Completed outgoing tracks release their media source, and disabling the experience or disposing the controller clears prepared music sources. Independent music/effects mute state and the existing view-specific volume levels remain unchanged.

The five derivatives use Apple's `afconvert -f m4af -d aac -b 128000 -q 127 <original> <derivative>`, without gain, resampling, trimming, or timing edits. Each retains its source's exact decoded valid-frame count at stereo 48 kHz, with AAC gapless priming/remainder metadata; decoded RMS differences are below 0.04 dB. Original files remain byte-for-byte recovery/provenance sources, and runtime volume controls supply the quieter presentation. AAC compression is lossy; these measurements do not claim subjective listening approval.

| Runtime derivative | Original bytes | Runtime bytes | Reduction |
| --- | ---: | ---: | ---: |
| `far-away-city-traffic-ambience.m4a` | 18,857,098 | 1,046,406 | 94.45% |
| `background-416-chiptune.m4a` | 8,222,208 | 4,058,227 | 50.64% |
| `background-platform-shoes.m4a` | 5,215,488 | 2,666,280 | 48.88% |
| `background-pixel-dreams.m4a` | 5,362,944 | 2,671,983 | 50.18% |
| `background-exploration-chiptune.m4a` | 7,198,464 | 3,575,797 | 50.33% |

Together these runtime replacements reduce the five assets from 44,856,202 to 14,018,693 bytes (68.75%); the playlist still downloads progressively as playback reaches each track.
