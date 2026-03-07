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
      "personalised insights based on Big Five personality traits and tailor API call responses. Built with Swift (frontend), " +
      "NestJS (API), and PostgreSQL (database). Base personality model trained in Torch, " +
      "before being converted for Apple's CoreML library to be run entirely on-device, supporting local fine-tuning " +
      "to better suit individual user personalities.",
    tags: ["Swift", "CoreML", "NestJS", "PostgreSQL", "CUDA"],
    link: { href: "https://github.com/yuyanghu06/journey", label: "View Project" },
  },
  {
    size:    "wide" as const,
    label:   "2026 Startup Week Buildathon",
    heading: "Nootes - Merge ideas, not just text",
    body:
      "Platform built to allow users to open source their ideas. Share and fork documents, and let our AI merge changes together, " +
      "ensuring a smooth form of collaboration and synchronization. Utilize our in house agent to navigate the site, create new documents, " +
      "or simply generate new ideas on an existing document. Create mind graphs for better visualization and brainstorming. \n" +
      "Built using Vite (frontend), paired with Fast-API (backend) and PostgreSQL on Supabase (database). Deployed on Railway.",
    tags: ["Vite", "React", "Fast-API", "Railway", "Supabase"],
    link: { href: "https://nootes-beryl.vercel.app/", label: "View Project" },
  },
  {
    size:    "third" as const,
    height:  375,
    photo:   "/public/photos/NOOTES.png"
  },
  {
    size:    "third" as const,
    label:   "S25 @ Portland State",
    heading: "PAINT",
    body:
      "Diffusion based MOE pipeline for art restoration, designed to be used as a research aid by academic collaboraters",
    height: 297,
    tags: ["Stable Diffusion", "MOE", "ART"],
  },
  {
    size:    "wide" as const,
    label:   "2026 Gemini Hackathon",
    heading: "Cronicl",
    body:
      "AI storyboarder, automatically generating visuals for user ideas.\n" +
      "Built using Vite, Nest.JS, and Gemini's APIs",
    link: { href: "https://cronicl-production.up.railway.app/", label: "View Project" },
    tags: ["Gemini", "Storyboarding"],
  },
  {
    size:    "wide" as const,
    label:   "F24 NYU DS Club Project Expo: Runner Up Project",
    heading: "Presidential Speech Analysis",
    body:
      "Small library built in Java, utilizing the Gunning Fox Index on scraped presidential speeches from the Miller Center " +
      "to analyze presidential speech complexity. Won the runner-up award at the DSC's Project Expo.",
    tags: ["Gunning Fox Index", "Java", "DSC", "Project Expo"],
    link: { href: "https://github.com/yuyanghu06/presidentialSpeechAnalysis", label: "View Project" },
  },
  {
    size:    "third" as const,
    label:   "F25 BAC ML",
    heading: "dAIgnosis",
    body:
      "LLM fine-tuned on synthetic datasets to output medical advice to help serve unprivileged communities. " +
      "Hard-coded COT logic using custom MCP layer built using MongoDB.",
    tags: ["MongoDB", "Mistral7b", "LORA", "GRPO"],
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
          <p className="page-header-sub">Personal · Research · Hackathons</p>
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

