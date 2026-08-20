# Immediate gray datum

- Removed the road-GLB dependency from the gray ground reveal.
- The datum now begins its 220 ms fade on the first animation frame while the road GLB, Meshopt decoder, building manifest, and center tiles load concurrently.
- Roads remain the first geometry spring, followed by buildings after the 50 ms handoff.
