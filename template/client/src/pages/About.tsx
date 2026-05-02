import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import ContentBlock from "../components/ContentBlock";
import "../styles/interior.css";

// ═══════════════════════════════════════════════════════════════════════════════
// ABOUT PAGE — Edit the blocks below to fill in your own information.
//
// Size options: "full" | "wide" | "half" | "third"
//   full  = spans all 3 columns
//   wide  = spans 2 columns
//   third = spans 1 column
//
// PHOTOS: set `photo` to a path under /public/ e.g. "/public/photos/portrait.jpeg"
// LINE BREAKS: use \n inside body strings for new paragraphs
// ═══════════════════════════════════════════════════════════════════════════════
const ABOUT_BLOCKS = [
  {
    size:    "full" as const,
    label:   "ABOUT ME",
    heading: "Your Name",
    body:
      "Write a brief introduction about yourself here. Who are you, what do you do, " +
      "and what are you passionate about? Keep it conversational and authentic.",
  },
  {
    size:    "wide" as const,
    label:   "EDUCATION",
    heading: "Your University — Your Program",
    height:  320,
    body:
      "Your degree and major here\n" +
      "Relevant coursework: List your key courses\n" +
      "Campus activities: List your clubs and organisations",
    tags: ["School", "Major", "Expected Graduation"],
  },
  {
    size:    "third" as const,
    label:   "PHOTO",
    heading: "A photo of you",
    // ✏️ Replace with your own photo path
    photo:   "/public/photos/PORTRAIT.jpeg",
  },
  {
    size:    "third" as const,
    label:   "LOCATION",
    heading: "Your City",
    body:
      "Where you're based and what kind of work you're open to.\n" +
      "Remote, hybrid, in-person — whatever applies.",
  },
  {
    size:    "wide" as const,
    label:   "EXPERTISE",
    heading: "Your Focus Area",
    body:
      "Describe your primary area of expertise or research interest.\n" +
      "What problems do you like solving?",
    tags: ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
  },
  {
    // ✏️ Replace with a landscape photo
    size:    "wide" as const,
    height:  530,
    photo:   "/public/photos/LANDSCAPE.jpeg",
  },
  {
    size:    "third" as const,
    label:   "LEADERSHIP",
    heading: "Your Leadership Roles",
    body:
      "Describe any leadership positions, mentoring, teaching, or community work.\n" +
      "What impact have you had?",
    tags: ["Role 1", "Role 2"],
  },
  {
    size:    "third" as const,
    label:   "INTERESTS",
    heading: "Away from the keyboard",
    body:
      "What do you enjoy outside of work? Hobbies, sports, creative pursuits — " +
      "let people see the human side of you."
  },
  {
    size:    "full" as const,
    label:   "CONTACT",
    heading: "Let's build something together",
    body:
      "A closing call-to-action. Invite people to reach out.\n" +
      "Always open to interesting conversations.",
    link: { href: "https://linkedin.com/in/YOUR_HANDLE", label: "Connect on LinkedIn" },
  },
] as const;

export default function About() {
  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">
        <header className="page-header">
          <h1>About Me</h1>
          <p className="page-header-sub">Background · Education · Interests</p>
        </header>

        <div className="block-grid">
          {ABOUT_BLOCKS.map((block) => (
            <ContentBlock key={block.heading} {...block} />
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
