# Community crowd soundtrack

- Trimmed the supplied crowd recording to 80 seconds and encoded it as `public/audio/community-crowd-talking-1m20.m4a`.
- Looped it quietly in Washington Square and Union Square, stopping and rewinding it outside those zoomed-in views.
- Added the 2.168-second world-cloud effect for zoom-ins, with reverse playback when returning to the Manhattan overview.
- Reduced the zoom effect to half volume and added 180 ms fades at both ends.
- Added the user-provided 65-second city-traffic recording as a quiet loop for the base Manhattan overview; crowd audio remains off there.
- Ambient soundtracks now wait until camera transitions have fully settled before starting.
- Fixed the zoom-effect fade scheduler so playback does not remain silent at the initial zero timestamp.
- Shortened the zoom-effect fades from 180 ms to 60 ms so the effect becomes audible sooner.
- Increased the zoom-effect maximum volume to 75% and shortened the fade to 40 ms.
- Restricted the zoom effect to globe ↔ Manhattan travel; park and individual-building zooms are silent.
- Added a 1.2-second traffic fade-in, kept traffic continuous during park zooms, and raised it to `0.2592` in neighborhood views.
- Reduced the zoom-effect maximum volume by another 50% to `0.1875`.
- Lowered the traffic ambience levels by 50% to `0.108` base and `0.1296` in neighborhood views.
- Increased the base Manhattan traffic ambience volume by 20% to `0.216`.
