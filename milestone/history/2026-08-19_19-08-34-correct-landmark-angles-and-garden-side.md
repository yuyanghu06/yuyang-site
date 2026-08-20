# Correct landmark angles and garden side

- Applied explicit south/front-side selection azimuths to both Stern and Courant instead of allowing them to use the north-side default angle.
- Preserved independent world-space target centers and the shared close orthographic framing required by the interactive-landmark workflow.
- Moved Courant's seven-tree garden from the cramped west gap to the open east forecourt wedge marked by the user.
- Verified every relocated tree center remains outside official roadbeds and CityGML building footprints.
- Verified with `npm run lint` and `npm run build`; both pass.
