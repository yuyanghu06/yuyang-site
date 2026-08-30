# Mobile swipe and pinch map zoom

Extended the shared map input controller so mobile users can navigate every zoom level with either one-finger vertical swipes or two-finger pinches. Upward swipes and outward pinches zoom in; downward swipes and inward pinches zoom out. Non-globe touch zoom is thresholded and reuses the existing wheel gesture guards, while horizontal drag rotation remains intact.

Updated the interaction and milestone documentation. Targeted ESLint and full TypeScript validation pass.
