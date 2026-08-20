# Washington Square tree boundary clearance

- Added the authoritative Washington Square Park OSM boundary ring to the generated park dataset.
- Replaced the approximate elliptical tree-placement boundary with full-crown containment checks against the park polygon.
- Each candidate uses 24 perimeter probes around its scaled crown plus a 0.6-meter safety margin; all probes must remain in the park.
- The deterministic layout still accepts all 88 trees, including 14 tall specimens.
- Verified with ESLint, a production Next.js build, and a deterministic crown-containment audit.
