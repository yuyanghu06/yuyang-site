export const CONFIG = {
  backgroundImage: "/public/photos/BACKGROUND.jpeg",

  // ── Hero text ────────────────────────────────────────────────────────────────
  heroText: "I AM YUYANG",
  subText: "Get to know the real me",

  // ── Navigation links ─────────────────────────────────────────────────────────
  navLinks: [
    { label: "Home",     path: "/" },
    { label: "About",    path: "/about" },
    { label: "Projects", path: "/projects" },
    { label: "Contact",  path: "/contact" },
  ],

  // ── Bottom-strip social links ─────────────────────────────────────────────────
  // icon: "instagram" | "github" | "linkedin"
  socialLinks: [
    { label: "Instagram", icon: "instagram", href: "https://www.instagram.com/yuyanghu06/" },
    { label: "Github",    icon: "github",    href: "https://github.com/yuyanghu06" },
    { label: "LinkedIn",  icon: "linkedin",  href: "https://www.linkedin.com/in/yuyanghu06/" },
  ],

  // ── Homepage sections (modifiable placeholder text) ───────────────────────────
  featuredStory: {
    label:   "FEATURED PROJECT",
    heading: "Journey",
    body:    "AI-powered journaling app with a Swift/NestJS/PostgreSQL stack featuring a custom on-device Core ML LLM for personalized Big Five personality-based insights.",
    cta:     "LINK",
  },

  stories: [
    {
      label:   "MACHINE LEARNING",
      heading: "On the frontier of AI research",
      excerpt: "My work sits at the intersection of systems design and applied ML — building agentic runtimes, RAG pipelines, and edge inference infrastructure for production AI applications.",
    },
    {
      label:   "FULLSTACK DEVELOPMENT",
      heading: "End-to-end engineering",
      excerpt: "From REST APIs and database schemas to reactive frontends, I architect and ship full-stack applications across hackathons, production deployments, and client projects — primarily in TypeScript and Node.js ecosystems.",
    },
    {
      label:   "LEADERSHIP EXPERIENCE",
      heading: "Beneath the Surface",
      excerpt: "I lead ML education and mentorship programs at NYU — holding board positions in the Business Analyics Club at Stern and Tech@NYU, one of the largest tech clubs in New York City",
    },
  ],

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
