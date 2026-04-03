import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * MessageContent
 * --------------
 * Renders chat message text with support for:
 *   - *bold*        → <strong>
 *   - $inline math$ → KaTeX inline
 *   - $$block math$$ → KaTeX display
 *   - \n             → line breaks
 *
 * Parses left-to-right in one pass so delimiters don't interfere with each other.
 */

type Node = React.ReactNode;

// Matches (in priority order): block math, inline math, bold
const SEGMENT_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*[^*\n]+?\*)/g;

function renderMath(src: string, display: boolean, key: number): Node {
  try {
    const html = katex.renderToString(src, { displayMode: display, throwOnError: false, output: "html" });
    return (
      <span
        key={key}
        className={display ? "math-block" : "math-inline"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return display ? `$$${src}$$` : `$${src}$`;
  }
}

function parseLine(line: string): Node[] {
  const nodes: Node[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  // Reset regex state between calls
  SEGMENT_RE.lastIndex = 0;

  while ((match = SEGMENT_RE.exec(line)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const seg = match[1];

    if (seg.startsWith("$$")) {
      nodes.push(renderMath(seg.slice(2, -2).trim(), true,  key++));
    } else if (seg.startsWith("$")) {
      nodes.push(renderMath(seg.slice(1, -1).trim(), false, key++));
    } else {
      // *bold*
      nodes.push(<strong key={key++}>{seg.slice(1, -1)}</strong>);
    }

    lastIndex = match.index + seg.length;
  }

  // Remaining plain text
  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {parseLine(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}
