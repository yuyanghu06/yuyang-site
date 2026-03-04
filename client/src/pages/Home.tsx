import { FaInstagram, FaLinkedinIn, FaGithub } from "react-icons/fa";
import { IconType } from "react-icons";
import Navbar from "../components/Navbar";
import HeroBg from "../components/HeroBg";
import SliderControls from "../components/SliderControls";
import { CONFIG } from "../config";
import "../styles/hero.css";

const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: FaInstagram,
  linkedin:  FaLinkedinIn,
  github:    FaGithub,
};

export default function Home() {
  return (
    <div className="home">

      {/* ── Hero section ── */}
      <section className="hero">
        <HeroBg />
        <Navbar />

        <div className="hero-center">
          <h1 className="hero-display">{CONFIG.heroText}</h1>
          <p className="hero-subtitle">{CONFIG.subText}</p>
          <div className="hero-dots">
            <span>●</span><span>●</span><span>○</span>
          </div>
        </div>

        <SliderControls />

        <footer className="hero-footer">
          <hr className="hero-rule" />
          <div className="hero-socials">
            {CONFIG.socialLinks.map(({ label, icon, href }) => {
              const Icon = SOCIAL_ICONS[icon];
              return (
                <a key={label} href={href} aria-label={label} target="_blank" rel="noreferrer">
                  {Icon ? <Icon /> : icon}
                </a>
              );
            })}
          </div>
        </footer>
      </section>

      {/* ── Featured story ── */}
      <section className="home-section home-featured">
        <div className="home-section-inner">
          <span className="section-label">{CONFIG.featuredStory.label}</span>
          <h2 className="section-heading">{CONFIG.featuredStory.heading}</h2>
          <p className="section-body">{CONFIG.featuredStory.body}</p>
          <a className="section-cta" href="#">{CONFIG.featuredStory.cta}</a>
        </div>
      </section>

      {/* ── Story grid ── */}
      <section className="home-section home-grid-section">
        <div className="home-section-inner">
          <span className="section-label">LATEST STORIES</span>
          <div className="story-grid">
            {CONFIG.stories.map((s) => (
              <article className="story-card" key={s.heading}>
                <span className="story-card-label">{s.label}</span>
                <h3 className="story-card-heading">{s.heading}</h3>
                <p className="story-card-excerpt">{s.excerpt}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="home-section home-quote-section">
        <blockquote className="pull-quote">
          <p>"{CONFIG.pullQuote.text}"</p>
          <cite>{CONFIG.pullQuote.source}</cite>
        </blockquote>
      </section>

    </div>
  );
}
