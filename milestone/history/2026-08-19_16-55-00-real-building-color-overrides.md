# Real building color overrides

- Matched three user-identified buildings to the local NYC address/BIN index and CityGML records.
- Added stable landmark palettes for One Fifth Avenue (`1008847`), the NYU Silver Center complex (`1008820`), and Lipton Hall (`1008875`).
- One Fifth now uses weathered dark-gray stone, Silver Center uses pale gray-beige masonry, and Lipton Hall uses muted red-brown brick, each with separate roof and ground tones.
- Overrides run before the hashed context palette so future neighborhood palette edits will not recolor these buildings.
- `npm run lint` and `npm run build` both pass.
