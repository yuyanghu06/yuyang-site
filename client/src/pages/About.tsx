import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import ContentBlock from "../components/ContentBlock";
import "../styles/interior.css";

// ── About page content ────────────────────────────────────────────────────────
// Edit any field below to update the page. Add or remove block objects to
// change the layout. Size options: "full" | "wide" | "half" | "third"
//
// PHOTOS: set `photo` to any path under /public/ e.g. "/public/photos/my-photo.jpeg"
//         The image will fill the entire block. Text fields are optional with photos.
//
// LINE BREAKS: use \n inside a body string to create a new paragraph.
//              e.g.  body: "First paragraph.\nSecond paragraph."
const ABOUT_BLOCKS = [
  {
    size:    "full" as const,
    label:   "ABOUT ME",
    heading: "Yuyang Hu",
    body:
      "I'm a sophomore at New York University doing a dual major in Mathematics and Computer Science. " +
      "I build things at the intersection of machine learning and software engineering, whether that's on-device small parameter LLMs " +
      "capable of running inference on iPhones, or fine-tuned diffusion model pipelines for academic research. " +
      "I'm deeply interested in model size optimization and using mathematics to replicate the human mind.",
  },
  {
    size:    "wide" as const,
    label:   "EDUCATION",
    heading: "New York University — Courant Institute of Mathematics",
    height:  320,
    body:
      "B.A. in Mathematics, B.A. in Computer Science \n" +
      "Relevant coursework: Data Structures, Linear Algebra, Probability Theory, Algorithms, " +
      "Algebra, Real & Numerical Analysis \n" +
      "Campus activities: Business Analyics Club, Tech@NYU, Tzu Ching Collegiate Association",
    tags: ["NYU", "Mathematics", "Computer Science", "Expected May 2028"],
  },
  {
    // ── Photo block ──────────────────────────────────────────────────────────
    // Set `photo` to your image path. Remove label/heading/body for image-only.
    // Example: photo: "/public/photos/portrait.jpeg"
    size:    "third" as const,
    label:   "YUYANG",
    heading: "In the flesh",
    photo:   "/public/photos/ME.jpeg",   // ← replace with your photo path
  },
  {
    size:    "third" as const,
    label:   "LOCATION",
    heading: "NYC & San Diego",
    body:
      "Based in both Manhattan and San Diego. Available for internships, research roles, and freelance projects.\n" +
      "Open to remote work.",
  },
  {
    size:    "wide" as const,
    label:   "MACHINE LEARNING",
    heading: "Research Interests",
    body:
      "Agentic systems, RAG pipelines, on-device inference, and model performance optimization.\n" +
      "Especially interested in the overlap between cognitive science, linguistics, and applied AI.",
    tags: ["LLMs", "RAG", "CoreML", "Edge AI"],
  },
  {
    // ── Wide photo block ─────────────────────────────────────────────────────
    // Great for landscape / action shots. Swap the path below.
    size:    "wide" as const,
    height:  530,
    photo:   "/public/photos/NEW_YORK.jpeg",   // ← replace with your photo path
  },
  {
    size:    "third" as const,
    label:   "LEADERSHIP",
    heading: "Tech@NYU & Business Analytics Club",
    body:
      "Mentorship lead for Tech@NYU — the largest student tech organisation in New York City. " +
      "I head a team connecting sudents with professionals working across the tech landscape, helping them develop valuable soft and hard skills. \n" +
      "Co-director of the Machine Learning Team for the Business Analytics Club at NYU Stern, " +
      "teaching students the mathematics of ML models and guiding them through hands on projects with real companies like iMasons and Blackbox.",
    tags: ["Tech@NYU", "Stern BAC", "Teaching", "Mentorship"],
  },
  {
    size:    "third" as const,
    label:   "INTERESTS",
    heading: "Away from the keyboard",
    body:
      "Long-distance running, science fiction novels, obscure historical subjects, playing country songs on my guitar, and enjoying the great outdoors."
  },
  {
    size:     "wide" as const,
    photo:    "/public/photos/HIKING.jpeg"
  },
  {
    size:    "full" as const,
    label:   "CONTACT",
    heading: "Let's build something together",
    body:
      "Whether you have a project, a research question, or just want to connect — feel free to reach out " +
      "via LinkedIn or email.\n" +
      "I'm always open to interesting conversations.",
    link: { href: "https://www.linkedin.com/in/yuyanghu06/", label: "Connect on LinkedIn" },
  },
] as const;

export default function About() {
  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">

        {/* Page title */}
        <header className="page-header">
          <h1>About Me</h1>
          <p className="page-header-sub">Background · Education · Interests</p>
        </header>

        {/* Dynamic block grid — edit ABOUT_BLOCKS above to customise */}
        <div className="block-grid">
          {ABOUT_BLOCKS.map((block) => (
            <ContentBlock key={block.heading} {...block} />
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}

