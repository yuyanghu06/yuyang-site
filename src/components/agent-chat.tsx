"use client";

import "@/styles/agent-chat.css";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  dispatchAgentCommand,
  MAP_VIEW_SETTLED_EVENT,
  requestAvatarEmote,
  type AgentMessage,
  type AgentStatus,
  type AgentStreamEvent,
  type MapDestination,
  type MapViewSettledDetail,
} from "@/agent/contracts/types";
import {
  bobstLibraryDialogue,
  courantInstituteDialogue,
  introDialogue,
  liptonHallDialogue,
  manhattanDialogue,
  sternSchoolOfBusinessDialogue,
  twentyFiveUnionSquareWestDialogue,
  twoThirtyFiveParkAvenueSouthDialogue,
  unionSquareDialogue,
  washingtonSquareDialogue,
} from "./dialogue";
import { playDialogueBlip, primeDialogueAudio, stopDialogueBlip } from "./site-audio";

const YUYANG_BIRTH_DATE = { year: 2006, month: 10, day: 29 } as const;
const getYuyangAge = (today = new Date()) => {
  const birthdayHasPassed = today.getMonth() + 1 > YUYANG_BIRTH_DATE.month
    || (today.getMonth() + 1 === YUYANG_BIRTH_DATE.month && today.getDate() >= YUYANG_BIRTH_DATE.day);
  return today.getFullYear() - YUYANG_BIRTH_DATE.year - (birthdayHasPassed ? 0 : 1);
};
const INTRO_GREETING = introDialogue.replace("{{age}}", String(getYuyangAge()));
const STREAM_BLIP_INTERVAL_MS = 58;
const DOCKED_CAPTION_FADE_MS = 180;
const MAX_CAPTION_CHARACTERS = 120;
const MIN_CAPTION_BREAK_CHARACTERS = Math.floor(MAX_CAPTION_CHARACTERS * 0.4);
const DIALOGUE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
type IntroPhase = "greeting" | "choice" | "declining" | "declined" | "touring" | "manhattan_arrival" | "manhattan_choice" | "washington_arrival" | "washington_next" | "lipton_arrival" | "lipton_next" | "bobst_arrival" | "bobst_next" | "stern_next" | "courant_next" | "camera_dialogue_streaming" | "free";

const AnimatedAgentStatus = ({ status }: { status: AgentStatus }) => {
  const label = status === "remembering" ? "Remembering…" : status === "researching" ? "Researching…" : "Thinking…";
  return (
    <span className="agent-chat__thinking" role="status" aria-live="polite" aria-label={label}>
      {Array.from(label).map((character, index) => (
        <span
          key={`${character}-${index}`}
          aria-hidden="true"
          style={{ "--agent-wave-index": index } as CSSProperties}
        >
          {character}
        </span>
      ))}
    </span>
  );
};

const splitCaptionText = (content: string) => {
  const links: string[] = [];
  const protectedContent = content.replace(DIALOGUE_LINK_PATTERN, (link) => {
    const placeholder = `\uE000${links.length}\uE001`;
    links.push(link);
    return placeholder;
  });
  const segments: string[] = [];
  let remaining = protectedContent.trim();
  while (remaining.length > MAX_CAPTION_CHARACTERS) {
    const preferredWindow = remaining.slice(0, MAX_CAPTION_CHARACTERS + 1);
    const preferredParagraphBreak = preferredWindow.lastIndexOf("\n\n");
    const preferredLineBreak = preferredWindow.lastIndexOf("\n");
    const preferredPunctuationBreak = [...preferredWindow.matchAll(/[.!?:](?=\s|$)/g)].at(-1)?.index ?? -1;
    const preferredBreak = Math.max(
      preferredParagraphBreak >= MIN_CAPTION_BREAK_CHARACTERS ? preferredParagraphBreak : -1,
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
    const boundaries = [overflow.indexOf("\n\n"), overflow.indexOf("\n"), overflow.search(/[.!?:](?=\s|$)/)]
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
  return segments.map((segment) => segment.replace(/\uE000(\d+)\uE001/g, (_, index: string) => links[Number(index)]));
};

const renderDialogueContent = (content: string) => {
  const rendered: ReactNode[] = [];
  let cursor = 0;
  for (const match of content.matchAll(DIALOGUE_LINK_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) rendered.push(content.slice(cursor, matchIndex));
    rendered.push(
      <a key={`${matchIndex}-${match[2]}`} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>,
    );
    cursor = matchIndex + match[0].length;
  }
  if (cursor < content.length) rendered.push(content.slice(cursor));
  return rendered;
};

export const primeAgentDialogueAudio = primeDialogueAudio;

const getCaptionScrollBounds = (list: HTMLDivElement) => {
  const assistantMessages = list.querySelectorAll<HTMLElement>(".agent-chat__message--assistant");
  if (assistantMessages.length === 0) return { minimum: 0, maximum: 0 };
  if (assistantMessages.length === 1) return { minimum: 0, maximum: 0 };
  const latest = assistantMessages.item(assistantMessages.length - 1);
  const scrollRoom = list.querySelector<HTMLElement>(".agent-chat__scroll-room");
  const lastVisibleItem = scrollRoom?.previousElementSibling instanceof HTMLElement
    ? scrollRoom.previousElementSibling
    : latest;
  const viewportFit = Math.max(0, lastVisibleItem.offsetTop + lastVisibleItem.offsetHeight - list.clientHeight + 16);
  const previousHalf = assistantMessages.length > 1
    ? assistantMessages.item(assistantMessages.length - 2).offsetTop
      + assistantMessages.item(assistantMessages.length - 2).offsetHeight / 2
    : 0;
  const maximum = Math.max(viewportFit, previousHalf);
  return { minimum: 0, maximum };
};

interface AgentChatProps {
  currentView: MapDestination;
  expanded: boolean;
  dockedCaptionVisible: boolean;
  onDismissDockedCaption: () => void;
  onRevealDockedCaption: () => void;
  onStreamingChange: (streaming: boolean) => void;
  onMinimize: () => void;
}

export default function AgentChat({ currentView, expanded, dockedCaptionVisible, onDismissDockedCaption, onRevealDockedCaption, onStreamingChange, onMinimize }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("greeting");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("thinking");
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [presentationAction, setPresentationAction] = useState<"next" | "reply" | null>(null);
  const [guidedTourActive, setGuidedTourActive] = useState(false);
  const [fixedCameraDialogueActive, setFixedCameraDialogueActive] = useState(false);
  const [scriptSegmentIndex, setScriptSegmentIndex] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const scriptTimerRef = useRef<number | null>(null);
  const lastStreamBlipAtRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const introPhaseRef = useRef(introPhase);
  const streamedTextRef = useRef("");
  const queuedCaptionSegmentsRef = useRef<string[]>([]);
  const shownScriptSegmentsRef = useRef<string[]>([]);
  const backwardTourDestinationRef = useRef<MapDestination | null>(null);
  const terminalPresentationRef = useRef<"next" | "reply" | null>(null);
  const unionTourShownRef = useRef(false);
  const washingtonTourShownRef = useRef(false);
  const guidedTourActiveRef = useRef(false);

  useEffect(() => {
    introPhaseRef.current = introPhase;
  }, [introPhase]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    const modal = list?.closest<HTMLElement>(".avatar-call__modal");
    if (!expanded || !list || !modal || !window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches) {
      modal?.style.removeProperty("--expanded-avatar-top");
      return;
    }

    const chat = list.closest<HTMLElement>(".agent-chat");
    if (!chat) return;
    const visibleElements = chat.querySelectorAll<HTMLElement>(
      ".agent-chat__message--latest, :scope > .agent-chat__choices, :scope > .agent-chat__reply, :scope > .agent-chat__form",
    );
    const modalTop = modal.getBoundingClientRect().top;
    const contentBottom = Array.from(visibleElements).reduce((bottom, element) => {
      if (getComputedStyle(element).display === "none") return bottom;
      return Math.max(bottom, element.getBoundingClientRect().bottom);
    }, list.getBoundingClientRect().top);
    modal.style.setProperty("--expanded-avatar-top", `${Math.max(0, contentBottom - modalTop + 12)}px`);

    return () => {
      modal.style.removeProperty("--expanded-avatar-top");
    };
  }, [composerOpen, expanded, introPhase, messages, pending, presentationAction]);

  const playStreamBlip = useCallback(() => {
    const now = performance.now();
    if (now - lastStreamBlipAtRef.current < STREAM_BLIP_INTERVAL_MS) return;
    lastStreamBlipAtRef.current = now;
    playDialogueBlip();
  }, []);

  const streamScript = useCallback((content: string, onComplete: () => void, preserveQueuedSegments = false) => {
    const [visibleContent = "", ...remainingSegments] = splitCaptionText(content);
    const streamingContent = visibleContent.replace(DIALOGUE_LINK_PATTERN, "$1");
    if (preserveQueuedSegments) {
      shownScriptSegmentsRef.current.push(visibleContent);
      setScriptSegmentIndex((current) => current + 1);
    }
    else {
      queuedCaptionSegmentsRef.current = remainingSegments;
      shownScriptSegmentsRef.current = [visibleContent];
      terminalPresentationRef.current = null;
      setPresentationAction(null);
      setScriptSegmentIndex(0);
    }
    if (scriptTimerRef.current !== null) window.clearTimeout(scriptTimerRef.current);
    flushSync(() => {
      setMessages((current) => {
        const latest = current.at(-1);
        if (latest?.role === "assistant" && (latest.content === visibleContent || visibleContent.startsWith(latest.content))) {
          return current.map((message, index) => index === current.length - 1 ? { ...message, content: "" } : message);
        }
        return [...current, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20);
      });
    });
    onStreamingChange(true);
    let length = 0;
    const revealNextChunk = () => {
      length = Math.min(streamingContent.length, length + (streamingContent[length] === " " ? 2 : 1));
      setMessages((current) => current.map((message, index) =>
        index === current.length - 1 ? { ...message, content: streamingContent.slice(0, length) } : message,
      ));
      if (/\S/.test(streamingContent[length - 1] ?? "")) playStreamBlip();
      if (length >= streamingContent.length) {
        setMessages((current) => current.map((message, index) =>
          index === current.length - 1 ? { ...message, content: visibleContent } : message,
        ));
        scriptTimerRef.current = null;
        onStreamingChange(false);
        onComplete();
        return;
      }
      const character = visibleContent[length - 1];
      const delay = character === "." || character === "?" ? 150 : character === "," ? 85 : 24;
      scriptTimerRef.current = window.setTimeout(revealNextChunk, delay);
    };
    revealNextChunk();
  }, [onStreamingChange, playStreamBlip]);

  useEffect(() => {
    const handleViewSettled = (event: Event) => {
      const { view } = (event as CustomEvent<MapViewSettledDetail>).detail;
      if (view === backwardTourDestinationRef.current) {
        backwardTourDestinationRef.current = null;
        const previousStop = view === "manhattan"
          ? { content: manhattanDialogue, phase: "manhattan_choice" as const }
          : view === "washington"
            ? { content: washingtonSquareDialogue, phase: "washington_next" as const }
            : view === "lipton-hall"
              ? { content: liptonHallDialogue, phase: "lipton_next" as const }
              : view === "bobst-library"
                ? { content: bobstLibraryDialogue, phase: "bobst_next" as const }
                : view === "stern-school-of-business"
                  ? { content: sternSchoolOfBusinessDialogue, phase: "stern_next" as const }
                  : null;
        if (previousStop) {
          introPhaseRef.current = "camera_dialogue_streaming";
          setIntroPhase("camera_dialogue_streaming");
          setFixedCameraDialogueActive(true);
          const lastSegment = splitCaptionText(previousStop.content).at(-1) ?? previousStop.content;
          streamScript(lastSegment, () => {
            introPhaseRef.current = previousStop.phase;
            setIntroPhase(previousStop.phase);
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          });
          return;
        }
      }
      const canStartWashingtonDialogue = introPhaseRef.current === "washington_arrival"
        || introPhaseRef.current === "manhattan_choice"
        || introPhaseRef.current === "free";
      if (view === "union" && introPhaseRef.current === "free" && !unionTourShownRef.current) {
        setFixedCameraDialogueActive(true);
        unionTourShownRef.current = true;
        streamScript(unionSquareDialogue, () => {
          introPhaseRef.current = "free";
          setIntroPhase("free");
          terminalPresentationRef.current = "reply";
          setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
        });
        return;
      }
      if (view === "washington" && canStartWashingtonDialogue && !washingtonTourShownRef.current) {
        setFixedCameraDialogueActive(true);
        washingtonTourShownRef.current = true;
        streamScript(washingtonSquareDialogue, () => {
          if (guidedTourActiveRef.current) {
            introPhaseRef.current = "washington_next";
            setIntroPhase("washington_next");
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          }
          else {
            introPhaseRef.current = "free";
            setIntroPhase("free");
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
        });
        return;
      }
      if (view === "lipton-hall" && introPhaseRef.current === "lipton_arrival") {
        setFixedCameraDialogueActive(true);
        streamScript(liptonHallDialogue, () => {
          introPhaseRef.current = "lipton_next";
          setIntroPhase("lipton_next");
          setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
        });
        return;
      }
      if (view === "bobst-library") {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        streamScript(bobstLibraryDialogue, () => {
          const nextPhase = guidedTourActiveRef.current ? "bobst_next" : "free";
          introPhaseRef.current = nextPhase;
          setIntroPhase(nextPhase);
          if (guidedTourActiveRef.current) {
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          }
          else {
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
        });
        return;
      }
      if (view === "stern-school-of-business") {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        streamScript(sternSchoolOfBusinessDialogue, () => {
          const nextPhase = guidedTourActiveRef.current ? "stern_next" : "free";
          introPhaseRef.current = nextPhase;
          setIntroPhase(nextPhase);
          if (guidedTourActiveRef.current) {
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          }
          else {
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
        });
        return;
      }
      if (view === "courant-institute") {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        streamScript(courantInstituteDialogue, () => {
          const nextPhase = guidedTourActiveRef.current ? "courant_next" : "free";
          introPhaseRef.current = nextPhase;
          setIntroPhase(nextPhase);
          if (guidedTourActiveRef.current) {
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          }
          else {
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
        });
        return;
      }
      if (view === "25-union-square-west" || view === "235-park-avenue-south") {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        const dialogue = view === "25-union-square-west"
          ? twentyFiveUnionSquareWestDialogue
          : twoThirtyFiveParkAvenueSouthDialogue;
        streamScript(dialogue, () => {
          introPhaseRef.current = "free";
          setIntroPhase("free");
          terminalPresentationRef.current = "reply";
          setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
        });
        return;
      }
      if (view !== "manhattan" || introPhaseRef.current !== "touring") return;
      introPhaseRef.current = "manhattan_arrival";
      setIntroPhase("manhattan_arrival");
      streamScript(manhattanDialogue, () => {
        introPhaseRef.current = "manhattan_choice";
        setIntroPhase("manhattan_choice");
        setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
      });
    };
    window.addEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
    return () => window.removeEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
  }, [streamScript]);

  const chooseManhattanNeighborhood = (destination: "union" | "washington") => {
    if (destination === "union") {
      guidedTourActiveRef.current = false;
      setGuidedTourActive(false);
    }
    const nextPhase = destination === "washington" ? "washington_arrival" : "free";
    introPhaseRef.current = nextPhase;
    setIntroPhase(nextPhase);
    onMinimize();
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  useEffect(() => {
    return stopDialogueBlip;
  }, []);

  useEffect(() => {
    scriptTimerRef.current = window.setTimeout(() => {
      streamScript(INTRO_GREETING, () => setIntroPhase("choice"));
    }, 0);
    return () => {
      if (scriptTimerRef.current !== null) window.clearTimeout(scriptTimerRef.current);
    };
  }, [streamScript]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list || !expanded) return;
    const { maximum } = getCaptionScrollBounds(list);
    list.scrollTo({ top: maximum, behavior: "auto" });
  }, [expanded, introPhase, messages.length, presentationAction]);

  const constrainCaptionScroll = () => {
    const list = messageListRef.current;
    if (!list) return;
    const { minimum, maximum } = getCaptionScrollBounds(list);
    if (list.scrollTop < minimum) list.scrollTop = minimum;
    else if (list.scrollTop > maximum) list.scrollTop = maximum;
  };

  const requestNextMessage = () => {
    const nextSegment = queuedCaptionSegmentsRef.current.shift();
    if (nextSegment) {
      streamScript(nextSegment, () => {
        setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : terminalPresentationRef.current);
      }, true);
      return;
    }
    setComposerOpen(true);
    setDraft("Continue the previous answer.");
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  const runAfterDockedCaptionFade = (action: () => void) => {
    if (expanded) {
      action();
      return;
    }
    onDismissDockedCaption();
    window.setTimeout(action, DOCKED_CAPTION_FADE_MS);
  };

  const returnToPreviousTourStop = () => {
    if (shownScriptSegmentsRef.current.length > 1) {
      const currentSegment = shownScriptSegmentsRef.current.pop();
      if (currentSegment) queuedCaptionSegmentsRef.current.unshift(currentSegment);
      setMessages((current) => {
        const lastAssistantIndex = current.findLastIndex((message) => message.role === "assistant");
        return lastAssistantIndex < 0 ? current : current.filter((_, index) => index !== lastAssistantIndex);
      });
      if (!expanded) onRevealDockedCaption();
      setPresentationAction("next");
      setScriptSegmentIndex((current) => Math.max(0, current - 1));
      return;
    }
    const destination = introPhaseRef.current === "washington_next" ? "manhattan"
      : introPhaseRef.current === "lipton_next" ? "washington"
        : introPhaseRef.current === "bobst_next" ? "lipton-hall"
          : introPhaseRef.current === "stern_next" ? "bobst-library"
            : introPhaseRef.current === "courant_next" ? "stern-school-of-business"
              : null;
    if (!destination) return;
    backwardTourDestinationRef.current = destination;
    introPhaseRef.current = "free";
    setIntroPhase("free");
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  const returnToPreviousFreeSegment = () => {
    if (shownScriptSegmentsRef.current.length <= 1) return;
    const currentSegment = shownScriptSegmentsRef.current.pop();
    if (currentSegment) queuedCaptionSegmentsRef.current.unshift(currentSegment);
    setMessages((current) => {
      const lastAssistantIndex = current.findLastIndex((message) => message.role === "assistant");
      return lastAssistantIndex < 0 ? current : current.filter((_, index) => index !== lastAssistantIndex);
    });
    setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
    setScriptSegmentIndex((current) => Math.max(0, current - 1));
    if (!expanded) onRevealDockedCaption();
  };

  const continueWashingtonTour = () => {
    introPhaseRef.current = "lipton_arrival";
    setIntroPhase("lipton_arrival");
    dispatchAgentCommand({ type: "navigate_map", destination: "lipton-hall" });
  };

  const continueFromLipton = () => {
    introPhaseRef.current = "bobst_arrival";
    setIntroPhase("bobst_arrival");
    dispatchAgentCommand({ type: "navigate_map", destination: "bobst-library" });
  };

  const continueFromBobst = () => {
    const nextSegment = queuedCaptionSegmentsRef.current.shift();
    if (nextSegment) {
      streamScript(nextSegment, () => undefined, true);
      return;
    }
    introPhaseRef.current = "free";
    setIntroPhase("free");
    dispatchAgentCommand({ type: "navigate_map", destination: "stern-school-of-business" });
  };

  const continueFromStern = () => {
    const nextSegment = queuedCaptionSegmentsRef.current.shift();
    if (nextSegment) {
      streamScript(nextSegment, () => undefined, true);
      return;
    }
    introPhaseRef.current = "free";
    setIntroPhase("free");
    dispatchAgentCommand({ type: "navigate_map", destination: "courant-institute" });
  };

  const continueFromCourant = () => {
    const nextSegment = queuedCaptionSegmentsRef.current.shift();
    if (nextSegment) {
      streamScript(nextSegment, () => undefined, true);
      return;
    }
    guidedTourActiveRef.current = false;
    setGuidedTourActive(false);
    introPhaseRef.current = "free";
    setIntroPhase("free");
    requestNextMessage();
  };

  const acceptTour = () => {
    guidedTourActiveRef.current = true;
    setGuidedTourActive(true);
    setComposerOpen(false);
    setIntroPhase("touring");
    streamScript("Gotcha, let me show you around.", () => {
      window.setTimeout(() => {
        onMinimize();
        window.requestAnimationFrame(() => {
          dispatchAgentCommand({ type: "navigate_map", destination: "manhattan" });
        });
      }, 280);
    });
  };

  const declineTour = () => {
    guidedTourActiveRef.current = false;
    setGuidedTourActive(false);
    setComposerOpen(false);
    setIntroPhase("declining");
    streamScript("Gotcha, feel free to take a look around.", () => setIntroPhase("declined"));
  };

  const finishDecline = () => {
    setIntroPhase("free");
    onMinimize();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    guidedTourActiveRef.current = false;
    setGuidedTourActive(false);
    introPhaseRef.current = "free";
    setIntroPhase("free");
    setFixedCameraDialogueActive(false);
    setScriptSegmentIndex(0);
    shownScriptSegmentsRef.current = [];
    backwardTourDestinationRef.current = null;
    const userMessage: AgentMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage].slice(-20);
    setMessages([...nextMessages, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20));
    setDraft("");
    setComposerOpen(false);
    setError("");
    setPresentationAction(null);
    streamedTextRef.current = "";
    queuedCaptionSegmentsRef.current = [];
    terminalPresentationRef.current = "reply";
    setPending(true);
    setAgentStatus("thinking");
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, currentView }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("The guide did not respond.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      while (true) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const streamEvent = JSON.parse(line) as AgentStreamEvent;
          if (streamEvent.type === "status") {
            setAgentStatus(streamEvent.status);
          } else if (streamEvent.type === "speech_start") {
            playStreamBlip();
          } else if (streamEvent.type === "text_delta") {
            if (!/\S/.test(streamedTextRef.current) && /\S/.test(streamEvent.delta)) onStreamingChange(true);
            if (/\S/.test(streamEvent.delta)) playStreamBlip();
            streamedTextRef.current += streamEvent.delta;
            const visibleContent = splitCaptionText(streamedTextRef.current)[0] ?? "";
            setMessages((current) => current.map((message, index) =>
              index === current.length - 1 ? { ...message, content: visibleContent } : message,
            ));
          } else if (streamEvent.type === "command") {
            if (streamEvent.command.type === "trigger_avatar_emote") {
              onStreamingChange(false);
              await requestAvatarEmote(streamEvent.command.emote);
              if (/\S/.test(streamedTextRef.current)) onStreamingChange(true);
            }
            else dispatchAgentCommand(streamEvent.command);
          } else if (streamEvent.type === "done") {
            const [visibleSegment = "", ...queuedSegments] = splitCaptionText(streamedTextRef.current);
            queuedCaptionSegmentsRef.current = queuedSegments;
            setMessages((current) => current.map((message, index) =>
              index === current.length - 1 ? { ...message, content: visibleSegment } : message,
            ));
            setPresentationAction(queuedSegments.length > 0 ? "next" : terminalPresentationRef.current);
          } else if (streamEvent.type === "error") {
            throw new Error(streamEvent.message);
          }
        }
        if (done) break;
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setMessages((current) => current.at(-1)?.role === "assistant" && !current.at(-1)?.content ? current.slice(0, -1) : current);
        setError(reason instanceof Error ? reason.message : "The guide is temporarily unavailable.");
      }
    } finally {
      if (requestRef.current === controller) {
        setPending(false);
        setAgentStatus("thinking");
        onStreamingChange(false);
      }
    }
  };

  const showFreeDialogueBack = !guidedTourActive
    && fixedCameraDialogueActive
    && introPhase === "free"
    && scriptSegmentIndex > 0;

  return (
    <div
      className={`agent-chat${dockedCaptionVisible ? " agent-chat--docked-visible" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className="agent-chat__messages"
        role="log"
        aria-live="polite"
        ref={messageListRef}
        onScroll={constrainCaptionScroll}
      >
        {messages.flatMap((message, messageIndex) => message.role === "assistant" ? [{ message, messageIndex }] : [])
          .map(({ message, messageIndex }, index, assistantMessages) => (
          <div key={`exchange-${messageIndex}`} className="agent-chat__exchange">
            {messages[messageIndex - 1]?.role === "user" && (
              <div className="agent-chat__message agent-chat__message--user">
                {messages[messageIndex - 1].content}
              </div>
            )}
            <div
            className={`agent-chat__message agent-chat__message--assistant liquid-glass-surface${index < assistantMessages.length - 1 ? " agent-chat__message--past" : " agent-chat__message--latest"}`}
            >
            {!expanded && dockedCaptionVisible && index === assistantMessages.length - 1 && (
              <button type="button" className="agent-chat__dock-dismiss" onClick={onDismissDockedCaption} aria-label="Dismiss caption">×</button>
            )}
            <div className="agent-chat__speaker-row">
              <span className="agent-chat__speaker">
                <span className="agent-chat__speaker-dot" aria-hidden="true">●</span>
                <span className="agent-chat__speaker-name">Yuyang</span>
              </span>
            </div>
            <span className="agent-chat__caption">
              {message.content ? renderDialogueContent(message.content) : (pending && index === assistantMessages.length - 1 ? (
                <AnimatedAgentStatus status={agentStatus} />
              ) : "…")}
            </span>
            {index === assistantMessages.length - 1 && introPhase === "choice" && !pending && presentationAction === null && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices" aria-label="Choose whether to start the tour">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(acceptTour)}>Yes</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(declineTour)}>No</button>
                </div>
                {composerOpen ? (
                  <form className="agent-chat__form agent-chat__form--inline" onSubmit={submit} ref={formRef}>
                    <div className="agent-chat__input-row">
                      <input id="agent-chat-input" aria-label="Reply to Yuyang" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4_000} placeholder="What would you like to know?" disabled={pending} autoFocus />
                      <button type="submit" disabled={pending || !draft.trim()} aria-label="Send message">↑</button>
                      <button
                        type="button"
                        className="agent-chat__composer-cancel"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); setComposerOpen(false); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                    <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                  </button>
                )}
              </div>
            )}
            {index === assistantMessages.length - 1 && introPhase === "declined" && !pending && presentationAction === null && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(finishDecline)}>Okay</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && introPhase === "manhattan_choice" && !pending && presentationAction === null && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div
                  className="agent-chat__choices agent-chat__choices--white"
                  aria-label="Choose a Manhattan neighborhood"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => chooseManhattanNeighborhood("union"))}>Union Square</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => chooseManhattanNeighborhood("washington"))}>Washington Square</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && (introPhase === "washington_next" || introPhase === "lipton_next" || introPhase === "bobst_next" || introPhase === "stern_next" || introPhase === "courant_next") && !pending && presentationAction === null && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div
                  className="agent-chat__choices"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button type="button" onClick={() => runAfterDockedCaptionFade(introPhase === "washington_next" ? continueWashingtonTour : introPhase === "lipton_next" ? continueFromLipton : introPhase === "bobst_next" ? continueFromBobst : introPhase === "stern_next" ? continueFromStern : continueFromCourant)}>Next</button>
                  {guidedTourActive && (
                    <button type="button" onClick={() => runAfterDockedCaptionFade(returnToPreviousTourStop)}>Back</button>
                  )}
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && showFreeDialogueBack && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices">
                  {presentationAction === "next" && (
                    <button type="button" onClick={() => runAfterDockedCaptionFade(requestNextMessage)}>Next</button>
                  )}
                  <button type="button" className="agent-chat__choice--secondary" onClick={() => runAfterDockedCaptionFade(returnToPreviousFreeSegment)}>Back</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && presentationAction && !showFreeDialogueBack && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className={`agent-chat__choices${presentationAction === "reply" ? " agent-chat__choices--white" : ""}`}>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(presentationAction === "next" ? requestNextMessage : onMinimize)}>
                    {presentationAction === "next" ? "Next" : "Done"}
                  </button>
                </div>
                {presentationAction === "reply" && (
                  <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                    <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                  </button>
                )}
              </div>
            )}
            {index === assistantMessages.length - 1 && !pending && !(composerOpen && introPhase === "choice" && presentationAction === null) && (composerOpen || (!showFreeDialogueBack && introPhase !== "greeting" && introPhase !== "choice" && introPhase !== "declined" && introPhase !== "manhattan_choice" && introPhase !== "washington_next" && introPhase !== "lipton_next" && introPhase !== "bobst_next" && introPhase !== "stern_next" && introPhase !== "courant_next" && introPhase !== "camera_dialogue_streaming" && presentationAction === null)) && (
              composerOpen ? (
                <form className="agent-chat__form agent-chat__form--inline" onSubmit={submit} ref={formRef}>
                  <div className="agent-chat__input-row">
                    <input id="agent-chat-input" aria-label="Reply to Yuyang" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4_000} placeholder="What would you like to know?" disabled={pending} autoFocus />
                    <button type="submit" disabled={pending || !draft.trim()} aria-label="Send message">↑</button>
                    <button
                      type="button"
                      className="agent-chat__composer-cancel"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => { event.stopPropagation(); setComposerOpen(false); }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="agent-chat__inline-reply"
                  onClick={() => setComposerOpen(true)}
                  disabled={pending}
                >
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span>{" "}
                  Reply…
                </button>
              )
            )}
            </div>
          </div>
        ))}
        {error && <p className="agent-chat__error">{error}</p>}
        <div className="agent-chat__scroll-room" aria-hidden="true" />
      </div>
    </div>
  );
}
