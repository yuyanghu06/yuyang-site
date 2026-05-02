import { CONFIG } from "../config";

export default function HeroBg() {
  return <div className="hero-bg" style={{ backgroundImage: `url(${CONFIG.backgroundImage})` }} />;
}
