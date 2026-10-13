const MAX_CAPTION_CHARACTERS = 120;
const MIN_CAPTION_BREAK_CHARACTERS = Math.floor(MAX_CAPTION_CHARACTERS * 0.4);
export const DIALOGUE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export const splitCaptionText = (content: string) => {
  const links: string[] = [];
  const protectedContent = content.replace(DIALOGUE_LINK_PATTERN, (link) => {
    const placeholder = `\uE000${links.length}\uE001`;
    links.push(link);
    return placeholder;
  });
  const segments: string[] = [];
  const paragraphs = protectedContent.trim().split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    let remaining = paragraph;
    while (remaining.length > MAX_CAPTION_CHARACTERS) {
      const preferredWindow = remaining.slice(0, MAX_CAPTION_CHARACTERS + 1);
      const preferredLineBreak = preferredWindow.lastIndexOf("\n");
      const preferredPunctuationBreak = [...preferredWindow.matchAll(/[.!?:](?=\s|$)/g)].at(-1)?.index ?? -1;
      const preferredBreak = Math.max(
        preferredLineBreak >= MIN_CAPTION_BREAK_CHARACTERS ? preferredLineBreak : -1,
        preferredPunctuationBreak >= MIN_CAPTION_BREAK_CHARACTERS ? preferredPunctuationBreak : -1,
      );
      if (preferredBreak >= 0) {
        const splitAt = remaining[preferredBreak] === "\n" ? preferredBreak : preferredBreak + 1;
        segments.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
        continue;
      }
      const overflow = remaining.slice(MAX_CAPTION_CHARACTERS);
      const boundaries = [overflow.indexOf("\n"), overflow.search(/[.!?:](?=\s|$)/)]
        .filter((boundary) => boundary >= 0)
        .sort((left, right) => left - right);
      const naturalBreak = boundaries[0] ?? -1;
      if (naturalBreak < 0) break;
      const boundary = MAX_CAPTION_CHARACTERS + naturalBreak;
      const splitAt = remaining[boundary] === "\n" ? boundary : boundary + 1;
      segments.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) segments.push(remaining);
  }
  return segments.map((segment) => segment.replace(/\uE000(\d+)\uE001/g, (_, index: string) => links[Number(index)]));
};
