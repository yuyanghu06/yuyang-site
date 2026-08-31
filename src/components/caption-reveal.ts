export type CaptionRevealHandle = { cancel: () => void };

interface CaptionRevealOptions {
  content: string;
  timingContent: string;
  onReveal: (content: string) => void;
  onBlip: () => void;
  onComplete: () => void;
}

export function startCaptionReveal({ content, timingContent, onReveal, onBlip, onComplete }: CaptionRevealOptions): CaptionRevealHandle {
  let frame = 0;
  let length = 0;
  let nextRevealAt = performance.now();
  let cancelled = false;

  const revealNextFrame = (now: number) => {
    if (cancelled) return;
    let advanced = false;
    let shouldBlip = false;
    let catchUpSteps = 0;
    while (length < content.length && now >= nextRevealAt && catchUpSteps < 6) {
      length = Math.min(content.length, length + (content[length] === " " ? 2 : 1));
      const character = timingContent[length - 1];
      nextRevealAt += character === "." || character === "?" ? 150 : character === "," ? 85 : 24;
      advanced = true;
      shouldBlip ||= /\S/.test(content[length - 1] ?? "");
      catchUpSteps += 1;
    }
    if (advanced) {
      onReveal(content.slice(0, length));
      if (shouldBlip) onBlip();
    }
    if (length >= content.length) {
      onComplete();
      return;
    }
    frame = requestAnimationFrame(revealNextFrame);
  };

  frame = requestAnimationFrame(revealNextFrame);
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}
