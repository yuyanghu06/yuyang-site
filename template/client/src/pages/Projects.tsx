import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import ContentBlock from "../components/ContentBlock";
import "../styles/interior.css";

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS PAGE — Edit the blocks below with your own projects.
//
// Size options: "full" | "wide" | "half" | "third"
// Add `photo` for screenshot blocks, `tags` for tech stack pills,
// and `link` for external project URLs.
// ═══════════════════════════════════════════════════════════════════════════════
const PROJECT_BLOCKS = [
  {
    size:    "full" as const,
    label:   "FEATURED PROJECT",
    heading: "Your Best Project",
    body:
      "Describe your most impressive project in detail. What problem does it solve? " +
      "What technologies did you use? What makes it special?\n" +
      "Add a second paragraph for technical details or outcomes.",
    tags: ["Tech 1", "Tech 2", "Tech 3", "Tech 4"],
    link: { href: "https://github.com/YOUR_HANDLE/project", label: "View Project" },
  },
  {
    size:    "wide" as const,
    label:   "CATEGORY",
    heading: "Another Project",
    body:
      "Describe this project — what it does and what you learned building it.\n" +
      "Include the tech stack and any notable achievements.",
    tags: ["Tech 1", "Tech 2", "Tech 3"],
    link: { href: "https://example.com", label: "View Project" },
  },
  {
    // ✏️ Add a screenshot of your project
    size:    "third" as const,
    height:  375,
    photo:   "/public/photos/PROJECT_SCREENSHOT.png"
  },
  {
    size:    "third" as const,
    label:   "HACKATHON",
    heading: "Quick Project",
    body:
      "A smaller project or hackathon entry. Brief description of what you built.",
    height: 297,
    tags: ["Tech 1", "Tech 2"],
  },
  {
    size:    "wide" as const,
    label:   "SIDE PROJECT",
    heading: "Yet Another Project",
    body:
      "Keep adding projects! The grid layout adapts to any number of blocks.\n" +
      "Mix full, wide, and third sizes for visual variety.",
    link: { href: "https://example.com", label: "View Project" },
    tags: ["Tech 1", "Tech 2"],
  },
] as const;

export default function Projects() {
  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">
        <header className="page-header">
          <h1>Projects</h1>
          <p className="page-header-sub">Personal · Research · Hackathons</p>
        </header>

        <div className="block-grid">
          {PROJECT_BLOCKS.map((block) => (
            <ContentBlock key={block.heading} {...block} />
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
