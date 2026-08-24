"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  dispatchAgentCommand,
  MAP_VIEW_SETTLED_EVENT,
  type AgentMessage,
  type AgentStreamEvent,
  type MapDestination,
  type MapViewSettledDetail,
} from "@/agent/types";

const YUYANG_BIRTH_DATE = { year: 2006, month: 10, day: 29 } as const;
const getYuyangAge = (today = new Date()) => {
  const birthdayHasPassed = today.getMonth() + 1 > YUYANG_BIRTH_DATE.month
    || (today.getMonth() + 1 === YUYANG_BIRTH_DATE.month && today.getDate() >= YUYANG_BIRTH_DATE.day);
  return today.getFullYear() - YUYANG_BIRTH_DATE.year - (birthdayHasPassed ? 0 : 1);
};
const INTRO_GREETING = `Hello! I’m Yuyang, a ${getYuyangAge()} year old college kid living in New York City. Do you want a tour of my world?`;
const MANHATTAN_TOUR_GREETING = "Welcome to Manhattan! I'm currently a Junior at NYU, and I spend most of my time split between either Union Square or Washington Square. Where would you like to go first?";
const WASHINGTON_SQUARE_TOUR_GREETING = "Washington square is where NYU has it's campus. This is where I take my classes, go to club meetings, and study.";
const LIPTON_HALL_TOUR_GREETING = "I also lived at Lipton hall, on the west side of the park my Freshman year!";
const STREAM_BLIP_INTERVAL_MS = 58;
const DOCKED_CAPTION_FADE_MS = 180;
const MAX_CAPTION_CHARACTERS = 170;
type IntroPhase = "greeting" | "choice" | "declining" | "declined" | "touring" | "manhattan_arrival" | "manhattan_choice" | "washington_arrival" | "washington_next" | "lipton_arrival" | "lipton_next" | "free";

const splitCaptionText = (content: string) => {
  const segments: string[] = [];
  let remaining = content.trim();
  while (remaining.length > MAX_CAPTION_CHARACTERS) {
    const window = remaining.slice(0, MAX_CAPTION_CHARACTERS + 1);
    const sentenceEnd = [...window.matchAll(/[.!?](?=\s|$)/g)].at(-1)?.index;
    const clauseEnd = [...window.matchAll(/[,;:](?=\s|$)/g)].at(-1)?.index;
    const whitespaceEnd = window.lastIndexOf(" ");
    const splitAt = sentenceEnd !== undefined && sentenceEnd >= MAX_CAPTION_CHARACTERS / 2
      ? sentenceEnd + 1
      : clauseEnd !== undefined && clauseEnd >= MAX_CAPTION_CHARACTERS / 2
        ? clauseEnd + 1
        : whitespaceEnd > 0 ? whitespaceEnd : MAX_CAPTION_CHARACTERS;
    segments.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) segments.push(remaining);
  return segments;
};

let sharedDialogueAudio: HTMLAudioElement | null = null;

const getDialogueAudio = () => {
  if (!sharedDialogueAudio) {
    sharedDialogueAudio = new Audio("/audio/sans-dialogue-blip.mp3");
    sharedDialogueAudio.preload = "auto";
    sharedDialogueAudio.volume = 0.11;
    sharedDialogueAudio.playbackRate = 1.4;
    sharedDialogueAudio.preservesPitch = false;
  }
  return sharedDialogueAudio;
};

export async function primeAgentDialogueAudio() {
  const audio = getDialogueAudio();
  const volume = audio.volume;
  audio.volume = 0;
  audio.currentTime = 0;
  await audio.play();
  audio.pause();
  audio.currentTime = 0;
  audio.volume = volume;
}

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
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [presentationAction, setPresentationAction] = useState<"next" | "reply" | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const scriptTimerRef = useRef<number | null>(null);
  const streamBlipRef = useRef<HTMLAudioElement | null>(null);
  const lastStreamBlipAtRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const introPhaseRef = useRef(introPhase);
  const streamedTextRef = useRef("");
  const queuedCaptionSegmentsRef = useRef<string[]>([]);
  const terminalPresentationRef = useRef<"next" | "reply" | null>(null);
  const washingtonTourShownRef = useRef(false);

  useEffect(() => {
    introPhaseRef.current = introPhase;
  }, [introPhase]);

  const playStreamBlip = useCallback(() => {
    const audio = streamBlipRef.current;
    const now = performance.now();
    if (!audio || now - lastStreamBlipAtRef.current < STREAM_BLIP_INTERVAL_MS) return;
    lastStreamBlipAtRef.current = now;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const streamScript = useCallback((content: string, onComplete: () => void) => {
    if (scriptTimerRef.current !== null) window.clearTimeout(scriptTimerRef.current);
    onStreamingChange(true);
    setMessages((current) => {
      const latest = current.at(-1);
      if (latest?.role === "assistant" && (latest.content === content || content.startsWith(latest.content))) {
        return current.map((message, index) => index === current.length - 1 ? { ...message, content: "" } : message);
      }
      return [...current, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20);
    });
    let length = 0;
    const revealNextChunk = () => {
      length = Math.min(content.length, length + (content[length] === " " ? 2 : 1));
      setMessages((current) => current.map((message, index) =>
        index === current.length - 1 ? { ...message, content: content.slice(0, length) } : message,
      ));
      if (/\S/.test(content[length - 1] ?? "")) playStreamBlip();
      if (length >= content.length) {
        scriptTimerRef.current = null;
        onStreamingChange(false);
        onComplete();
        return;
      }
      const character = content[length - 1];
      const delay = character === "." || character === "?" ? 150 : character === "," ? 85 : 24;
      scriptTimerRef.current = window.setTimeout(revealNextChunk, delay);
    };
    revealNextChunk();
  }, [onStreamingChange, playStreamBlip]);

  useEffect(() => {
    const handleViewSettled = (event: Event) => {
      const { view } = (event as CustomEvent<MapViewSettledDetail>).detail;
      const canStartWashingtonDialogue = introPhaseRef.current === "washington_arrival"
        || introPhaseRef.current === "manhattan_choice"
        || introPhaseRef.current === "free";
      if (view === "washington" && canStartWashingtonDialogue && !washingtonTourShownRef.current) {
        washingtonTourShownRef.current = true;
        const [firstSegment = "", ...remainingSegments] = splitCaptionText(WASHINGTON_SQUARE_TOUR_GREETING);
        queuedCaptionSegmentsRef.current = remainingSegments;
        streamScript(firstSegment, () => {
          introPhaseRef.current = "washington_next";
          setIntroPhase("washington_next");
        });
        return;
      }
      if (view === "lipton-hall" && introPhaseRef.current === "lipton_arrival") {
        streamScript(LIPTON_HALL_TOUR_GREETING, () => {
          introPhaseRef.current = "lipton_next";
          setIntroPhase("lipton_next");
        });
        return;
      }
      if (view !== "manhattan" || introPhaseRef.current !== "touring") return;
      introPhaseRef.current = "manhattan_arrival";
      setIntroPhase("manhattan_arrival");
      streamScript(MANHATTAN_TOUR_GREETING, () => {
        introPhaseRef.current = "manhattan_choice";
        setIntroPhase("manhattan_choice");
      });
    };
    window.addEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
    return () => window.removeEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
  }, [streamScript]);

  const chooseManhattanNeighborhood = (destination: "union" | "washington") => {
    const nextPhase = destination === "washington" ? "washington_arrival" : "free";
    introPhaseRef.current = nextPhase;
    setIntroPhase(nextPhase);
    onMinimize();
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  useEffect(() => {
    const audio = getDialogueAudio();
    streamBlipRef.current = audio;
    return () => {
      audio.pause();
      streamBlipRef.current = null;
    };
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
      setMessages((current) => [...current, { role: "assistant", content: nextSegment } satisfies AgentMessage].slice(-20));
      setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : terminalPresentationRef.current);
      if (!expanded) onRevealDockedCaption();
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

  const continueWashingtonTour = () => {
    introPhaseRef.current = "lipton_arrival";
    setIntroPhase("lipton_arrival");
    dispatchAgentCommand({ type: "navigate_map", destination: "lipton-hall" });
  };

  const continueFromLipton = () => {
    introPhaseRef.current = "free";
    setIntroPhase("free");
    requestNextMessage();
  };

  const acceptTour = () => {
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
    const userMessage: AgentMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage].slice(-20);
    setMessages([...nextMessages, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20));
    setDraft("");
    setComposerOpen(false);
    setError("");
    setPresentationAction(null);
    streamedTextRef.current = "";
    queuedCaptionSegmentsRef.current = [];
    terminalPresentationRef.current = null;
    setPending(true);
    onStreamingChange(true);
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
          if (streamEvent.type === "speech_start") {
            playStreamBlip();
          } else if (streamEvent.type === "text_delta") {
            if (/\S/.test(streamEvent.delta)) playStreamBlip();
            streamedTextRef.current += streamEvent.delta;
            const visibleContent = streamedTextRef.current.slice(0, MAX_CAPTION_CHARACTERS);
            setMessages((current) => current.map((message, index) =>
              index === current.length - 1 ? { ...message, content: visibleContent } : message,
            ));
          } else if (streamEvent.type === "command") {
            if (streamEvent.command.type === "display_blue") terminalPresentationRef.current = "next";
            else if (streamEvent.command.type === "display_white") terminalPresentationRef.current = "reply";
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
        onStreamingChange(false);
      }
    }
  };

  return (
    <div className={`agent-chat${dockedCaptionVisible ? " agent-chat--docked-visible" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div
        className="agent-chat__messages"
        role="log"
        aria-live="polite"
        ref={messageListRef}
        onScroll={constrainCaptionScroll}
      >
        {messages.filter((message) => message.role === "assistant").map((message, index, assistantMessages) => (
          <div
            className={`agent-chat__message agent-chat__message--assistant${index < assistantMessages.length - 1 ? " agent-chat__message--past" : " agent-chat__message--latest"}`}
            key={`assistant-${index}`}
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
              {message.content || (pending && index === assistantMessages.length - 1 ? (
                <span className="agent-chat__thinking" aria-label="Thinking">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              ) : "…")}
            </span>
            {index === assistantMessages.length - 1 && !expanded && introPhase === "choice" && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices" aria-label="Choose whether to start the tour">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(acceptTour)}>Yes</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(declineTour)}>No</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && !expanded && introPhase === "declined" && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(finishDecline)}>Okay</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && !expanded && introPhase === "manhattan_choice" && !composerOpen && (
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
            {index === assistantMessages.length - 1 && !expanded && (introPhase === "washington_next" || introPhase === "lipton_next") && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div
                  className="agent-chat__choices"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button type="button" onClick={() => runAfterDockedCaptionFade(introPhase === "washington_next" ? continueWashingtonTour : continueFromLipton)}>Next</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && !expanded && presentationAction && !composerOpen && (
              <div className="agent-chat__caption-actions">
                <div className={`agent-chat__choices${presentationAction === "reply" ? " agent-chat__choices--white" : ""}`}>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(presentationAction === "next" ? requestNextMessage : onMinimize)}>
                    {presentationAction === "next" ? "Next" : "Cancel"}
                  </button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && expanded && (introPhase === "manhattan_choice" || introPhase === "washington_next" || introPhase === "lipton_next") && !composerOpen && (
              <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setComposerOpen(true); }}>
                <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
              </button>
            )}
            {index === assistantMessages.length - 1 && !pending && (expanded || (introPhase !== "choice" && introPhase !== "declined")) && (composerOpen || (introPhase !== "greeting" && introPhase !== "manhattan_choice" && introPhase !== "washington_next" && introPhase !== "lipton_next" && presentationAction === null)) && (
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
        ))}
        {error && <p className="agent-chat__error">{error}</p>}
        {expanded && introPhase === "choice" && (
          <div className="agent-chat__choices" aria-label="Choose whether to start the tour">
            <button type="button" onClick={acceptTour}>Yes</button>
            <button type="button" onClick={declineTour}>No</button>
          </div>
        )}
        {expanded && introPhase === "declined" && (
          <div className="agent-chat__choices">
            <button type="button" onClick={finishDecline}>Okay</button>
          </div>
        )}
        {expanded && introPhase === "manhattan_choice" && (
          <div className="agent-chat__choices agent-chat__choices--white" aria-label="Choose a Manhattan neighborhood">
            <button type="button" onClick={() => chooseManhattanNeighborhood("union")}>Union Square</button>
            <button type="button" onClick={() => chooseManhattanNeighborhood("washington")}>Washington Square</button>
          </div>
        )}
        {expanded && (introPhase === "washington_next" || introPhase === "lipton_next") && (
          <button type="button" className="agent-chat__reply agent-chat__reply--blue" onClick={introPhase === "washington_next" ? continueWashingtonTour : continueFromLipton}>Next</button>
        )}
        {expanded && presentationAction === "next" && (
          <button type="button" className="agent-chat__reply agent-chat__reply--blue" onClick={requestNextMessage}>Next</button>
        )}
        {expanded && presentationAction === "reply" && (
          <button type="button" className="agent-chat__reply agent-chat__reply--white" onClick={onMinimize}>Cancel</button>
        )}
        <div className="agent-chat__scroll-room" aria-hidden="true" />
      </div>
    </div>
  );
}
