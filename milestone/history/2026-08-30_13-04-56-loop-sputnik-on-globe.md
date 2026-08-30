# Loop Sputnik signal on globe

- Wired `satellite-sputnik-beep-clean-quiet.mp3` as a continuous loop gated by the user's experience-start gesture.
- Playback runs only in the settled globe view, stops and resets as soon as globe travel begins, and remains silent throughout all city and landmark views.
- Preserved the existing map renderer and audio elements; teardown explicitly releases the satellite audio resource.
