# Globe outer zoom limit

- Kept the initial globe camera framing at 1,920 units.
- Reduced the maximum globe camera distance from 2,400 to 1,920 units.
- Routed wheel, trackpad, and two-touch outward zoom attempts beyond the limit through the existing blocked-zoom pulse.
- Verified the production build succeeds with Next.js 16.3.0.
