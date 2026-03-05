import React from "react";
import { useLocation } from "react-router-dom";

/**
 * PageTransition — wraps the route tree and plays a slide-in animation
 * whenever the pathname changes. The `key` prop forces React to unmount
 * and remount the div on every navigation, restarting the CSS animation.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  // Re-key on every pathname change so the animation always replays from the start
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
