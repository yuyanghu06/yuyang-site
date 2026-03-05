import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import ContentBlock from "../components/ContentBlock";
import "../styles/interior.css";

// ── Projects page content ─────────────────────────────────────────────────────
// Edit any field below to update the page. Add or remove block objects to
// change the layout. Size options: "full" | "wide" | "half" | "third"
const PROJECT_BLOCKS = [
  {
    size:    "full" as const,
    label:   "FEATURED PROJECT",
    heading: "Journey — AI-Powered Journaling App",
    body:
      "An iOS journaling application that uses a custom on-device Core ML language model to surface " +
      "personalised insights based on Big Five personality traits. Built with Swift (frontend), " +
      "NestJS (API), and PostgreSQL (database). The model runs entirely on-device — no cloud calls " +
      "for inference, preserving user privacy.",
    tags: ["Swift", "Core ML", "NestJS", "PostgreSQL", "Big Five"],
    link: { href: "#", label: "View Project" },
  },
  {
    size:    "wide" as const,
    label:   "PROJECT",
    heading: "Placeholder Project Title",
    body:
      "Brief description of what this project does, the problem it solves, and what technologies " +
      "power it. Edit this text and the tags below to reflect your work.",
    tags: ["TypeScript", "React", "Node.js"],
    link: { href: "#", label: "View Project" },
  },
  {
    size:    "third" as const,
    label:   "PROJECT",
    heading: "Placeholder Project",
    body:
      "Short description. What it does and why you built it. One to two sentences is enough for a small card.",
    tags: ["Python", "ML"],
  },
  {
    size:    "third" as const,
    label:   "PROJECT",
    heading: "Placeholder Project",
    body:
      "Short description. What it does and why you built it. One to two sentences is enough for a small card.",
    tags: ["Rust", "Systems"],
  },
  {
    size:    "third" as const,
    label:   "PROJECT",
    heading: "Placeholder Project",
    body:
      "Short description. What it does and why you built it. One to two sentences is enough for a small card.",
    tags: ["Go", "API"],
  },
  {
    size:    "wide" as const,
    label:   "PROJECT",
    heading: "Placeholder Project Title",
    body:
      "Medium-length description for a wider card. Use this size when the project needs a bit more " +
      "context — a paragraph or two explaining the architecture, challenges, or outcomes.",
    tags: ["Next.js", "Prisma", "Vercel"],
    link: { href: "#", label: "View Project" },
  },
  {
    size:    "third" as const,
    label:   "HACKATHON",
    heading: "Placeholder Hackathon Project",
    body:
      "Built at [Hackathon Name] in [duration]. What you made and what you won (if anything). " +
      "Edit this block to reflect your experience.",
    tags: ["24h", "Award"],
  },
] as const;

export default function Projects() {
  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">

        {/* Page title */}
        <header className="page-header">
          <h1>Projects</h1>
          <p className="page-header-sub">Work · Experiments · Hackathons</p>
        </header>

        {/* Dynamic block grid — edit PROJECT_BLOCKS above to customise */}
        <div className="block-grid">
          {PROJECT_BLOCKS.map((block) => (
            <ContentBlock key={block.heading} {...block} />
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}

