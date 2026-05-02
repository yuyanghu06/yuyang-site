import React from "react";
import { motion } from "framer-motion";

const slideVariants = {
  initial: { x: "6%" },
  animate: { x: 0 },
  exit:    { x: "-6%" },
};

const transition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

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
