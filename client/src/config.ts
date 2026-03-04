export const CONFIG = {
  backgroundImage: "/public/photos/BACKGROUND.jpeg",

  // ── Hero text ────────────────────────────────────────────────────────────────
  heroText: "NATURE",
  subText: "INTO THE WILD",

  // ── Navigation links ─────────────────────────────────────────────────────────
  navLinks: [
    { label: "Home",    path: "/" },
    { label: "About",   path: "/about" },
    { label: "Service", path: "/service" },
    { label: "Contact", path: "/contact" },
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
    label:   "FEATURED STORY",
    heading: "Where the Wild Things Are",
    body:    "An expedition into the untouched highlands of Patagonia — where glaciers carve silence into stone and condors drift above ancient valleys without names.",
    cta:     "READ MORE",
  },

  stories: [
    {
      label:   "WILDLIFE",
      heading: "The Last Migration",
      excerpt: "Tracking the final herds across the Serengeti as climate reshapes a century-old journey.",
    },
    {
      label:   "LANDSCAPE",
      heading: "Light Before Dawn",
      excerpt: "A photographer's 30-day vigil in Iceland — waiting for the sky to break open.",
    },
    {
      label:   "OCEAN",
      heading: "Beneath the Surface",
      excerpt: "Deep-sea surveys reveal ecosystems that science has only begun to name.",
    },
  ],

  pullQuote: {
    text:   "The wild does not need us to witness it — but we are lesser without the attempt.",
    source: "Editorial, Vol. XII",
  },
};
