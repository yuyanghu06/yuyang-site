import { CONFIG } from "../config";

/**
 * HeroBg — fixed background image for the home page.
 * Rendered in App.tsx outside all animated containers so it never flickers
 * during framer-motion page transitions.
 */
export default function HeroBg() {
  return <div className="hero-bg" style={{ backgroundImage: `url(${CONFIG.backgroundImage})` }} />;
}
