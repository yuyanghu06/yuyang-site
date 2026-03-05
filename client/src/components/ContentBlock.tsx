import React from "react";
import "../styles/interior.css";

// Block size controls how many grid columns the block spans
// "full" = all 3 cols | "wide" = 2 cols | "half" = 1.5 cols (via CSS) | "third" = 1 col
export type BlockSize = "full" | "wide" | "half" | "third";

interface ContentBlockProps {
  size:     BlockSize;       // Grid column span
  label?:   string;          // Small ALL-CAPS eyebrow text
  heading:  string;          // Main block heading
  body?:    string;          // Body copy — use \n for manual line breaks; omit for photo-only blocks
  tags?:    string[];        // Optional tag pills (tech stack, skills, etc.)
  link?:    { href: string; label: string }; // Optional CTA link
  // Set photo to a path under /public/ to fill the entire block with an image.
  // Example: "/public/photos/my-photo.jpeg"
  // When photo is set the image fills the card; text overlays at the bottom.
  photo?:   string;
  // Optional pixel overrides — these stack on top of the size-based grid span.
  // Example: width: 420, height: 300
  // Width is applied as min-width so the grid column still clamps it if needed.
  width?:   number;          // Explicit width in px
  height?:  number;          // Explicit height in px
}

/**
 * Splits a body string on literal "\n" sequences and renders each segment
 * as its own paragraph, giving authors manual control over line breaks.
 */
function BodyText({ text }: { text: string }) {
  // \n in a TS string literal is a real newline character — split on that
  const paragraphs = text.split("\n");
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className="block-body">{para.trim()}</p>
      ))}
    </>
  );
}

/**
 * ContentBlock — a single frosted-glass editorial card.
 * Grid span is driven by the `size` prop via a CSS class.
 * Add a `photo` path to fill the block with an image (text overlays at bottom).
 * Use \n in body strings to insert manual paragraph breaks.
 */
export default function ContentBlock({
  size,
  label,
  heading,
  body,
  tags,
  link,
  photo,
  width,
  height,
}: ContentBlockProps) {
  // Photo blocks get an extra modifier class that switches the layout to image-fill
  const blockClass = [
    "content-block",
    `content-block--${size}`,
    photo ? "content-block--photo" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Build inline style — only set width/height when explicitly provided
  const blockStyle: React.CSSProperties = {
    ...(width  !== undefined && { width:     `${width}px`  }),
    ...(height !== undefined && { minHeight: `${height}px` }),
  };

  return (
    <article className={blockClass} style={blockStyle}>

      {/* ── Photo fill ── */}
      {photo && (
        <img
          className="block-photo"
          src={photo}
          alt={heading}         // Heading doubles as alt text; change if needed
          loading="lazy"        // Browser-native lazy loading
        />
      )}

      {/* ── Text overlay / content area ── */}
      {/* When a photo is present this sits above a gradient scrim at the bottom */}
      <div className={photo ? "block-overlay" : "block-text"}>

        {/* Eyebrow label */}
        {label && <span className="block-label">{label}</span>}

        {/* Main heading */}
        <h2 className="block-heading">{heading}</h2>

        {/* Body — split on \n for manual paragraph breaks */}
        {body && <BodyText text={body} />}

        {/* Optional tag row */}
        {tags && tags.length > 0 && (
          <ul className="block-tags" aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag} className="block-tag">{tag}</li>
            ))}
          </ul>
        )}

        {/* Optional CTA link */}
        {link && (
          <a
            className="block-link"
            href={link.href}
            target="_blank"
            rel="noreferrer"
          >
            {link.label} &#8599;
          </a>
        )}
      </div>

    </article>
  );
}

