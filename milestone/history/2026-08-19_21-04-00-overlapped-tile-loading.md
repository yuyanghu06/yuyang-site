# Overlapped tile loading

- Removed the 1.47-second delay before ordinary building network requests.
- Tile downloads and Meshopt decoding now overlap the road spring and pause.
- Each tile still respects the visual reveal gate: early tiles wait below ground, while late tiles spring immediately after decoding.
- Confirmed the Washington travel arrow is world-pinned to the indicated northeast building cluster around local `(320, -260)`.
