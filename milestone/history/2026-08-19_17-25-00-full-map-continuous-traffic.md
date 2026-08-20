# Full-map continuous traffic

- Found that the 100-car assignment consumed only the first 100 entries from a much larger angularly sorted verified-route list, leaving a large directional portion of the map empty.
- Changed route assignment to sample evenly across the complete ordered list, distributing the fixed 100-car population through all map directions.
- Replaced modulo teleporting with continuous ping-pong travel; cars now turn around at validated route endpoints without jumping across a street segment.
- Preserved road/building clearance validation, travel-vector orientation, deterministic movement, and the every-third-car taxi rule.
- `npm run lint` and `npm run build` pass.
