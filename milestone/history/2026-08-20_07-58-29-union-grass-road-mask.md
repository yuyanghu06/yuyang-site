# Union Square grass road mask

- Correctly identified the remaining Union Square artifact as raised grass clipping over the roadbed, rather than malformed road or path geometry.
- Applied the existing official roadbed stencil to the Union Square and Gramercy park-ground material with a `NotEqual` test.
- Grass is now excluded anywhere the authoritative asphalt mesh has written the road stencil, including the southern Union Square junction.
- Confirmed `npm run lint` and `npm run build` pass.
