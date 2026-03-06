import { FaInstagram, FaLinkedinIn, FaGithub } from "react-icons/fa";
import { IconType } from "react-icons";
import Navbar from "../components/Navbar";
import HeroBg from "../components/HeroBg";
import SliderControls from "../components/SliderControls";
import ChatBot from "../components/ChatBot";
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
        </div>

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

      {/* ── Featured Project ── */}
      <section className="home-section home-featured">
        <div className="home-section-inner">
          <span className="section-label">{CONFIG.featuredStory.label}</span>
          <h2 className="section-heading">{CONFIG.featuredStory.heading}</h2>
          {/* Split on \n so authors can insert manual paragraph breaks in config.ts */}
          {CONFIG.featuredStory.body.split("\n").map((para, i) => (
            <p key={i} className="section-body">{para.trim()}</p>
          ))}
          <a className="section-cta" href="https://github.com/yuyanghu06/journey">{CONFIG.featuredStory.cta}</a>
        </div>
      </section>

      {/* ── Skills ── */}
      <section className="home-section home-grid-section">
        <div className="home-section-inner">
          <span className="section-label">SKILLS</span>
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

      {/* ── Chatbot section ── */}
      <ChatBot />

    </div>
  );
}
