# Separate mobile avatar framing

- Removed the rejected fixed docked render-plane dimensions and mobile proportional scale correction that distorted desktop and could blank mobile rendering after resize.
- Restored the exact approved desktop docked transform and scale.
- Added fully independent mobile docked and expanded coordinates/scales under the narrow breakpoint.
- Whitespace validation passes.
