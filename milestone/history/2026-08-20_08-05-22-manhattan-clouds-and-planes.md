# Manhattan clouds and planes

- Extended the existing sky-traveler lifecycle with explicit Manhattan-only and neighborhood-only visibility modes.
- Added five softly modeled low-poly cloud clusters with staggered positions, scales, heights, and drift speeds to the base Manhattan view.
- Added two low-detail planes that loop across the overview in opposite directions at separate altitudes.
- Kept the existing close-view bird flock unchanged; Manhattan clouds and planes hide in Washington and Union, while birds remain hidden at Manhattan scale.
- Confirmed `npm run lint` and `npm run build` pass.
