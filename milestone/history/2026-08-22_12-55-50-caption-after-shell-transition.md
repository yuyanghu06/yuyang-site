# Caption after shell transition

Caption visibility now follows the complete 460 ms avatar-shell geometry transition. The docked bubble stays hidden until minimization settles, and the fullscreen caption starts fading only after expansion reaches its final size.

A dedicated dock-settled ref prevents streams that begin during minimization from appearing early while preserving immediate reveal for new streams that start after the avatar is already docked.
