# Globe view

Globe geometry, materials, marker anchoring, and star-field construction live here. There are no direct subfolders. Globe code does not own neighborhood geometry.

## Files

- `scene.ts` constructs the globe placeholder, stars, and independent New York City and San Diego markers. Both use the imported globe's calibrated WGS84 longitude +224° convention. San Diego is anchored in Torrey Highlands rather than downtown, with a leftward label leader to separate it from New York. Each city exposes a north-up travel orientation.
- `info.md` is this folder guide.
