# Fix docked mobile caption cascade

- Identified the generic mobile `height: 45%` declaration as the winning rule that cropped docked captions to one line.
- Reset docked mobile and short-landscape chat height to intrinsic `auto` sizing.
- Corrected the docked width calculation to retain a 1.25-rem viewport-edge inset.
- Extended the docked mobile treatment to short landscape layouts up to 900 px wide.
- CSS whitespace validation passes.
