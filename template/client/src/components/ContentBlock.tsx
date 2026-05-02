import React from "react";
import "../styles/interior.css";

export type BlockSize = "full" | "wide" | "half" | "third";

interface ContentBlockProps {
  size:     BlockSize;
  label?:   string;
  heading:  string;
  body?:    string;
  tags?:    string[];
  link?:    { href: string; label: string };
  photo?:   string;
  width?:   number;
  height?:  number;
}

function BodyText({ text }: { text: string }) {
  const paragraphs = text.split("\n");
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className="block-body">{para.trim()}</p>
      ))}
    </>
  );
}

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
  const blockClass = [
    "content-block",
    `content-block--${size}`,
    photo ? "content-block--photo" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const blockStyle: React.CSSProperties = {
    ...(width  !== undefined && { width:     `${width}px`  }),
    ...(height !== undefined && { minHeight: `${height}px` }),
  };

  return (
    <article className={blockClass} style={blockStyle}>
      {photo && (
        <img
          className="block-photo"
          src={photo}
          alt={heading}
          loading="lazy"
        />
      )}

      <div className={photo ? "block-overlay" : "block-text"}>
        {label && <span className="block-label">{label}</span>}
        <h2 className="block-heading">{heading}</h2>
        {body && <BodyText text={body} />}
        {tags && tags.length > 0 && (
          <ul className="block-tags" aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag} className="block-tag">{tag}</li>
            ))}
          </ul>
        )}
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
