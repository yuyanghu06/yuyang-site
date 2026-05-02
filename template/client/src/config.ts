// ═══════════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION — Edit this file to customise your entire site
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the single source of truth for all site content that appears on
// the frontend. Change your name, bio, projects, social links, and more —
// everything is driven from this file.
//
// PHOTOS: Place images in public/photos/ and reference them as
//         "/public/photos/YOUR_IMAGE.jpeg"

export const CONFIG = {
  // Path to your hero background image (place file in public/photos/)
  backgroundImage: "/public/photos/BACKGROUND.jpeg",

  // ── Hero text (displayed on the landing page) ───────────────────────────────
  heroText: "YOUR NAME",
  subText: "Your tagline goes here",

  // ── Navigation links ────────────────────────────────────────────────────────
  navLinks: [
    { label: "Home",     path: "/" },
    { label: "About",    path: "/about" },
    { label: "Projects", path: "/projects" },
    { label: "Contact",  path: "/contact" },
  ],

  // ── Social links (displayed in the hero footer) ─────────────────────────────
  // icon: "instagram" | "github" | "linkedin"
  socialLinks: [
    { label: "Instagram", icon: "instagram", href: "https://instagram.com/YOUR_HANDLE" },
    { label: "Github",    icon: "github",    href: "https://github.com/YOUR_HANDLE" },
    { label: "LinkedIn",  icon: "linkedin",  href: "https://linkedin.com/in/YOUR_HANDLE" },
  ],

  // ── Featured project (displayed below the hero section) ─────────────────────
  featuredStory: {
    label:   "FEATURED PROJECT",
    heading: "Your Project Name",
    body:    "A brief description of your featured project. Explain what it does, what technologies you used, and why it matters.\n" +
             "You can add a second paragraph with \\n for a line break.",
    cta:     "VIEW PROJECT",
    ctaHref: "https://github.com/YOUR_HANDLE/your-project",
  },

  // ── Skills / story cards (3-column grid on the homepage) ────────────────────
  stories: [
    {
      label:   "SKILL AREA 1",
      heading: "What you do best",
      excerpt: "A short description of this skill area. Keep it to 2-3 sentences.",
    },
    {
      label:   "SKILL AREA 2",
      heading: "Another strength",
      excerpt: "Describe another area of expertise or interest.",
    },
    {
      label:   "SKILL AREA 3",
      heading: "One more thing",
      excerpt: "Round out the grid with a third skill, interest, or focus area.",
    },
  ],

  // ── Contact page text ───────────────────────────────────────────────────────
  contact: {
    heading: "Get in Touch",
    subheading: "Have a project in mind or just want to say hello?",
    namePlaceholder:    "Your name",
    emailPlaceholder:   "Your email",
    messagePlaceholder: "Your message",
    submitLabel: "SEND MESSAGE",
    successMessage: "Message sent — I'll be in touch soon.",
    errorMessage:   "Something went wrong. Please try again.",
  },
};
