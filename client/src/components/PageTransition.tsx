import React from "react";
import { motion } from "framer-motion";

/** Slide variants — new page enters from the right, exits to the left.
 *  No opacity change here — content stays fully visible during transitions;
 *  the BlurOverlay handles the background fade separately. */
const slideVariants = {
  initial: { x: "6%" },
  animate: { x: 0 },
  exit:    { x: "-6%" },
};

const transition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

/**
 * PageTransition — wrap each route in this so AnimatePresence (in App.tsx)
 * can play the exit animation before the next page mounts.
 * z-index:10 keeps all page content (including navbar) above the BlurOverlay
 * (z-index:1) so only the background is blurred, not the text.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={slideVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      style={{ minHeight: "100%", width: "100%", position: "relative", zIndex: 10 }}
    >
      {children}
    </motion.div>
  );
}
