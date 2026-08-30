import MapShell from "@/components/map/map-shell";
import "@/styles/social-links.css";

export default function Home() {
  return (
    <>
      <nav className="social-links" aria-label="Yuyang's social profiles">
        <a className="liquid-glass-control" href="https://github.com/yuyanghu06" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6a9.6 9.6 0 0 0-3 18.7c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.4-2.3-.3-4.6-1.1-4.6-4.8 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.2 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.5 1 2.6 0 3.7-2.3 4.5-4.6 4.8.4.3.7 1 .7 1.9v2.7c0 .4.2.6.7.5A9.6 9.6 0 0 0 12 2.6Z" /></svg>
        </a>
        <a className="liquid-glass-control" href="https://www.linkedin.com/in/yuyanghu06" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.2H3.3V19h3.2V8.2ZM4.9 3a1.9 1.9 0 1 0 0 3.8A1.9 1.9 0 0 0 4.9 3ZM20.7 12.8c0-3.3-1.8-4.9-4.2-4.9-1.9 0-2.8 1.1-3.3 1.8V8.2H10V19h3.2v-5.3c0-1.4.3-2.8 2.1-2.8s1.9 1.7 1.9 2.9V19h3.2l.3-6.2Z" /></svg>
        </a>
        <a className="liquid-glass-control" href="https://www.instagram.com/yuyanghu06" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.5" cy="6.7" r="1" className="social-links__solid" /></svg>
        </a>
      </nav>
      <MapShell />
    </>
  );
}
