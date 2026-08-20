# Enchantment glow and contextual scrolling

- Animated the persistent landmark glow with a violet-to-cyan hue cycle and soft intensity pulse inspired by Minecraft's enchantment sheen.
- Kept a visible idle glow and strengthened it during hover and selection.
- Assigned Stern and Courant the orientation shown in the supplied reference screenshots while retaining Bobst's opposite front-facing selection view.
- Scroll-in over a landmark now triggers its full selection animation.
- Scroll-in away from landmarks produces a small `1.08x` elastic zoom, pauses for 260 ms, and returns to overview.
- Escape and scroll-out continue to clear selection and restore the overview.
- `npm run lint` and `npm run build` pass.
