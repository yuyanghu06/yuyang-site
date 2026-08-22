# Second full-screen avatar enlargement

The full-screen avatar camera now renders the avatar at 225% of its original scale, which is 50% larger than the preceding 150% pass. The vertical camera target moved from 88% to 78% of measured avatar height, placing the avatar upward by 10% of its height.

The horizontal offset remains divided by the active scale factor, preserving the existing left/right screen placement instead of letting the additional zoom push the avatar sideways.

Targeted ESLint, TypeScript, and whitespace checks pass.
