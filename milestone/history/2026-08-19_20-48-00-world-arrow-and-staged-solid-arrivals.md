# World arrow and staged solid arrivals

- Replaced the DOM navigation control with a clickable Three.js arrow floating above the roofline.
- Oriented the arrow along the real diagonal vector between Washington and Union, reversing it for the return trip; increased it to mostly solid white with a soft glow.
- Changed the default canvas to white and made the gray sidewalk datum fade in instead of flashing immediately.
- Added a 350 ms pause after the road spring completes before ordinary building loading begins.
- Removed opacity animation from ordinary and custom buildings; they remain solid while rising and overshooting.
- Deferred interactive landmarks, Arch, Bobst, and other custom details until ordinary tiles finish, and gave them the same 34-unit spring curve.
- Deferred bird creation until the custom-geometry entrance stage completes.
- ESLint, TypeScript, and the optimized production build pass.
