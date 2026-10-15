"use client";

import "@/styles/agent-chat.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  cityChoiceDialogue,
  introDialogue,
  liptonHallDialogue,
  manhattanDialogue,
  unionSquareDialogue,
  washingtonSquareDialogue,
  sanDiegoCompleteDialogue,
} from "./dialogue";
import { getCaptionScrollBounds } from "./dialogue/caption-scroll";
import { getNextUnvisitedSanDiegoStop, getPreviousTourStop, getSanDiegoStop, isSanDiegoTourPhase, LANDMARK_DIALOGUES, SAN_DIEGO_STOPS, type IntroPhase } from "./dialogue/tour-stops";
import { DIALOGUE_LINK_PATTERN, splitCaptionText } from "./dialogue/caption-text";
import { startCaptionReveal, type CaptionRevealHandle } from "./caption-reveal";
import { AnimatedAgentStatus } from "./agent-status";
import { AgentComposer, AgentUserMessage, useAgentAttachments } from "./agent-composer";
import { prepareAgentRequestMessages } from "./agent-images";
import { TourDestinationChoices } from "./tour-destination-choices";
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
  const attachments = useAgentAttachments();
  const [pending, setPending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("thinking");
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [captionStreaming, setCaptionStreaming] = useState(false);
  const [presentationAction, setPresentationAction] = useState<"next" | "reply" | null>(null);
  const [guidedTourActive, setGuidedTourActive] = useState(false);
  const [fixedCameraDialogueActive, setFixedCameraDialogueActive] = useState(false);
  const [nextTourLocation, setNextTourLocation] = useState<"union" | "washington" | null>(null);
  const [scriptSegmentIndex, setScriptSegmentIndex] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const introTimerRef = useRef<number | null>(null);
  const captionRevealRef = useRef<CaptionRevealHandle | null>(null);
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
  const unionTourVisitedRef = useRef(false);
  const washingtonTourVisitedRef = useRef(false);
  const sanDiegoVisitedStopsRef = useRef(new Set<MapDestination>());
  const guidedTourActiveRef = useRef(false);
  const lastSettledViewRef = useRef<MapDestination>(currentView);
  const deferredCameraDialogueRef = useRef<(() => void) | null>(null);

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
      ".agent-chat__message--latest, :scope > .agent-chat__choices, :scope > .agent-chat__reply, :scope > .agent-chat__form:not(.agent-chat__form--expanded)",
    );
    let measurementFrame = 0;
    const measure = () => {
      cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(() => {
        const modalTop = modal.getBoundingClientRect().top;
        const contentBottom = Array.from(visibleElements).reduce((bottom, element) => {
          if (getComputedStyle(element).display === "none") return bottom;
          return Math.max(bottom, element.getBoundingClientRect().bottom);
        }, list.getBoundingClientRect().top);
        modal.style.setProperty("--expanded-avatar-top", `${Math.max(0, contentBottom - modalTop + 12)}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    visibleElements.forEach((element) => observer.observe(element));
    measure();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(measurementFrame);
      modal.style.removeProperty("--expanded-avatar-top");
    };
  }, [composerOpen, expanded, introPhase, messages.length, pending, presentationAction]);

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
    captionRevealRef.current?.cancel();
    flushSync(() => {
      setMessages((current) => {
        const latest = current.at(-1);
        if (latest?.role === "assistant" && (latest.content === visibleContent || visibleContent.startsWith(latest.content))) {
          return current.map((message, index) => index === current.length - 1 ? { ...message, content: "" } : message);
        }
        return [...current, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20);
      });
    });
    setCaptionStreaming(true);
    onStreamingChange(true);
    captionRevealRef.current = startCaptionReveal({
      content: streamingContent,
      timingContent: visibleContent,
      onReveal: (revealedContent) => {
        setMessages((current) => current.map((message, index) =>
          index === current.length - 1 ? { ...message, content: revealedContent } : message,
        ));
      },
      onBlip: playStreamBlip,
      onComplete: () => {
        setMessages((current) => current.map((message, index) =>
          index === current.length - 1 ? { ...message, content: visibleContent } : message,
        ));
        captionRevealRef.current = null;
        setCaptionStreaming(false);
        onStreamingChange(false);
        onComplete();
      },
    });
  }, [onStreamingChange, playStreamBlip]);

  const showDestinationChoice = useCallback((view: "globe" | "manhattan") => {
    const arrivalPhase = view === "globe" ? "globe_arrival" : "manhattan_arrival";
    const choicePhase = view === "globe" ? "globe_choice" : "manhattan_choice";
    introPhaseRef.current = arrivalPhase;
    setIntroPhase(arrivalPhase);
    setComposerOpen(false);
    setFixedCameraDialogueActive(view === "manhattan");
    streamScript(view === "globe" ? cityChoiceDialogue : manhattanDialogue, () => {
      introPhaseRef.current = choicePhase;
      setIntroPhase(choicePhase);
      setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
    });
  }, [streamScript]);

  useEffect(() => {
    const handleViewSettled = (event: Event) => {
      const { view } = (event as CustomEvent<MapViewSettledDetail>).detail;
      if (requestRef.current && getSanDiegoStop(view)) {
        deferredCameraDialogueRef.current = () => handleViewSettled(event);
        return;
      }
      deferredCameraDialogueRef.current = null;
      const previousView = lastSettledViewRef.current;
      lastSettledViewRef.current = view;
      if (view !== "san-diego" && getSanDiegoStop(view)) sanDiegoVisitedStopsRef.current.add(view);
      if (view === "globe" && guidedTourActiveRef.current
        && (introPhaseRef.current === "globe_arrival" || getSanDiegoStop(previousView))) {
        backwardTourDestinationRef.current = null;
        return showDestinationChoice("globe");
      }
      if (view === backwardTourDestinationRef.current) {
        backwardTourDestinationRef.current = null;
        const previousStop = getPreviousTourStop(view);
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
      const sanDiegoStop = getSanDiegoStop(view);
      if (sanDiegoStop) {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        streamScript(sanDiegoStop.content, () => {
          introPhaseRef.current = sanDiegoStop.phase;
          setIntroPhase(sanDiegoStop.phase);
          setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
        });
        return;
      }
      // Manual exit from San Diego must retire its route controls as well.
      if (getSanDiegoStop(previousView)) {
        const nextPhase = view === "manhattan" ? "touring" : "free";
        introPhaseRef.current = nextPhase;
        setIntroPhase(nextPhase);
        setFixedCameraDialogueActive(false);
        queuedCaptionSegmentsRef.current = [];
        shownScriptSegmentsRef.current = [];
        setScriptSegmentIndex(0);
        setPresentationAction(null);
        if (view === "globe") {
          guidedTourActiveRef.current = false;
          setGuidedTourActive(false);
          captionRevealRef.current?.cancel();
          setCaptionStreaming(false);
          onStreamingChange(false);
          terminalPresentationRef.current = "reply";
          setPresentationAction("reply");
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
          const nextPhase = guidedTourActiveRef.current ? "union_next" : "free";
          introPhaseRef.current = nextPhase;
          setIntroPhase(nextPhase);
          if (guidedTourActiveRef.current) setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          else {
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
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
      const landmarkDialogue = LANDMARK_DIALOGUES[view];
      if (landmarkDialogue) {
        introPhaseRef.current = "camera_dialogue_streaming";
        setIntroPhase("camera_dialogue_streaming");
        setFixedCameraDialogueActive(true);
        streamScript(landmarkDialogue.content, () => {
          const nextPhase = guidedTourActiveRef.current ? landmarkDialogue.phase : "free";
          introPhaseRef.current = nextPhase;
          setIntroPhase(nextPhase);
          if (guidedTourActiveRef.current) setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
          else {
            terminalPresentationRef.current = "reply";
            setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
          }
        });
        return;
      }
      if (view !== "manhattan" || (introPhaseRef.current !== "touring" && introPhaseRef.current !== "globe_choice")) return;
      showDestinationChoice("manhattan");
    };
    window.addEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
    return () => window.removeEventListener(MAP_VIEW_SETTLED_EVENT, handleViewSettled);
  }, [onStreamingChange, showDestinationChoice, streamScript]);

  const chooseNewYork = () => {
    guidedTourActiveRef.current = true;
    setGuidedTourActive(true);
    introPhaseRef.current = "touring";
    setIntroPhase("touring");
    setComposerOpen(false);
    onMinimize();
    if (lastSettledViewRef.current === "manhattan") return showDestinationChoice("manhattan");
    dispatchAgentCommand({ type: "navigate_map", destination: "manhattan" });
  };

  const navigateSanDiegoTour = (destination: MapDestination) => {
    guidedTourActiveRef.current = true;
    setGuidedTourActive(true);
    introPhaseRef.current = "camera_dialogue_streaming";
    setIntroPhase("camera_dialogue_streaming");
    onMinimize();
    const stop = getSanDiegoStop(destination);
    if (lastSettledViewRef.current === destination && stop) {
      if (destination !== "san-diego") sanDiegoVisitedStopsRef.current.add(destination);
      streamScript(stop.content, () => {
        introPhaseRef.current = stop.phase;
        setIntroPhase(stop.phase);
        setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
      });
      return;
    }
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  const chooseManhattanNeighborhood = (destination: "union" | "washington") => {
    if (destination === "union") unionTourShownRef.current = false;
    else washingtonTourShownRef.current = false;
    if (destination === "union") unionTourVisitedRef.current = true;
    else washingtonTourVisitedRef.current = true;
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
    introTimerRef.current = window.setTimeout(() => {
      streamScript(INTRO_GREETING, () => {
        setIntroPhase("choice");
        setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
      });
    }, 0);
    return () => {
      if (introTimerRef.current !== null) window.clearTimeout(introTimerRef.current);
      captionRevealRef.current?.cancel();
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

  const resumeDeferredCameraDialogue = () => {
    if (!requestRef.current && queuedCaptionSegmentsRef.current.length === 0) deferredCameraDialogueRef.current?.();
  };

  const requestNextMessage = () => {
    const nextSegment = queuedCaptionSegmentsRef.current.shift();
    if (nextSegment) {
      streamScript(nextSegment, () => {
        setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : terminalPresentationRef.current);
        resumeDeferredCameraDialogue();
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
    const sanDiegoStop = Object.values(SAN_DIEGO_STOPS).find((stop) => stop.phase === introPhaseRef.current);
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
    const destination = sanDiegoStop?.previous ?? (introPhaseRef.current === "washington_next" || introPhaseRef.current === "union_next" ? "manhattan"
      : introPhaseRef.current === "carlyle_next" ? "union"
        : introPhaseRef.current === "shift_next" ? "25-union-square-west"
          : introPhaseRef.current === "lipton_next" ? "washington"
            : introPhaseRef.current === "bobst_next" ? "lipton-hall"
              : introPhaseRef.current === "stern_next" ? "bobst-library"
                : introPhaseRef.current === "courant_next" ? "stern-school-of-business"
                  : null);
    if (!destination) return;
    backwardTourDestinationRef.current = destination;
    const nextPhase = destination === "globe" && guidedTourActiveRef.current ? "globe_arrival" : "free";
    introPhaseRef.current = nextPhase;
    setIntroPhase(nextPhase);
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  const continueSanDiegoTour = () => {
    const current = Object.entries(SAN_DIEGO_STOPS).find(([, stop]) => stop.phase === introPhaseRef.current)?.[0] as MapDestination | undefined;
    if (!current) return;
    if (current !== "san-diego") sanDiegoVisitedStopsRef.current.add(current);
    const next = getNextUnvisitedSanDiegoStop(current, sanDiegoVisitedStopsRef.current);
    if (next) {
      navigateSanDiegoTour(next);
      return;
    }
    introPhaseRef.current = "camera_dialogue_streaming";
    setIntroPhase("camera_dialogue_streaming");
    streamScript(sanDiegoCompleteDialogue, () => {
      introPhaseRef.current = "san_diego_complete";
      setIntroPhase("san_diego_complete");
      setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : null);
    });
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

  const continueUnionTour = () => {
    introPhaseRef.current = "camera_dialogue_streaming";
    setIntroPhase("camera_dialogue_streaming");
    dispatchAgentCommand({ type: "navigate_map", destination: "25-union-square-west" });
  };

  const continueFromCarlyle = () => {
    introPhaseRef.current = "camera_dialogue_streaming";
    setIntroPhase("camera_dialogue_streaming");
    dispatchAgentCommand({ type: "navigate_map", destination: "235-park-avenue-south" });
  };

  const offerOtherTourLocation = (destination: "union" | "washington") => {
    setNextTourLocation(destination);
    introPhaseRef.current = "camera_dialogue_streaming";
    setIntroPhase("camera_dialogue_streaming");
    const label = destination === "union" ? "Union Square" : "Washington Square";
    streamScript(`Ready to move on? We can head to ${label} next.`, () => {
      introPhaseRef.current = "tour_location_choice";
      setIntroPhase("tour_location_choice");
    });
  };

  const finishGuidedTour = () => {
    setNextTourLocation(null);
    guidedTourActiveRef.current = false;
    setGuidedTourActive(false);
    introPhaseRef.current = "free";
    setIntroPhase("free");
    terminalPresentationRef.current = "reply";
    setPresentationAction("reply");
  };

  const continueFromShift = () => {
    if (!washingtonTourVisitedRef.current) offerOtherTourLocation("washington");
    else finishGuidedTour();
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
    if (!unionTourVisitedRef.current) offerOtherTourLocation("union");
    else finishGuidedTour();
  };

  const moveToOtherTourLocation = () => {
    const destination = nextTourLocation;
    if (!destination) return;
    setNextTourLocation(null);
    if (destination === "union") unionTourVisitedRef.current = true;
    else washingtonTourVisitedRef.current = true;
    const nextPhase = destination === "washington" ? "washington_arrival" : "free";
    introPhaseRef.current = nextPhase;
    setIntroPhase(nextPhase);
    onMinimize();
    dispatchAgentCommand({ type: "navigate_map", destination });
  };

  const acceptTour = () => {
    sanDiegoVisitedStopsRef.current.clear();
    guidedTourActiveRef.current = true;
    setGuidedTourActive(true);
    setComposerOpen(false);
    introPhaseRef.current = "globe_arrival";
    setIntroPhase("globe_arrival");
    streamScript("Gotcha, let me show you around.", () => {
      window.setTimeout(() => {
        onMinimize();
        window.requestAnimationFrame(() => {
          if (lastSettledViewRef.current === "globe") showDestinationChoice("globe");
          else dispatchAgentCommand({ type: "navigate_map", destination: "globe" });
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
    if ((!content && !attachments.count) || pending || attachments.processing || requestRef.current) return;
    captionRevealRef.current?.cancel();
    captionRevealRef.current = null;
    setCaptionStreaming(false);
    onStreamingChange(false);
    stopDialogueBlip();
    deferredCameraDialogueRef.current = null;
    guidedTourActiveRef.current = false;
    setGuidedTourActive(false);
    introPhaseRef.current = "free";
    setIntroPhase("free");
    setFixedCameraDialogueActive(false);
    setScriptSegmentIndex(0);
    shownScriptSegmentsRef.current = [];
    backwardTourDestinationRef.current = null;
    const userMessage: AgentMessage = { role: "user", content, ...(attachments.images.length ? { images: attachments.images } : {}), ...(attachments.files.length ? { files: attachments.files } : {}) };
    const nextMessages = [...messages, userMessage].slice(-20);
    setMessages([...nextMessages, { role: "assistant", content: "" } satisfies AgentMessage].slice(-20));
    setDraft("");
    attachments.clear();
    setComposerOpen(false);
    setError("");
    setPresentationAction(null);
    streamedTextRef.current = "";
    queuedCaptionSegmentsRef.current = [];
    terminalPresentationRef.current = "reply";
    setPending(true);
    setAgentStatus("thinking");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: prepareAgentRequestMessages(nextMessages), currentView }),
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
            // The completed answer is revealed locally after it arrives so network
            // jitter cannot control the visible cadence or repeatedly restart audio.
          } else if (streamEvent.type === "text_delta") {
            streamedTextRef.current += streamEvent.delta;
          } else if (streamEvent.type === "command") {
            if (streamEvent.command.type === "trigger_avatar_emote") {
              onStreamingChange(false);
              await requestAvatarEmote(streamEvent.command.emote);
            }
            else dispatchAgentCommand(streamEvent.command);
          } else if (streamEvent.type === "done") {
            await new Promise<void>((resolve) => {
              streamScript(streamedTextRef.current, () => {
                terminalPresentationRef.current = "reply";
                setPresentationAction(queuedCaptionSegmentsRef.current.length > 0 ? "next" : "reply");
                resolve();
              });
            });
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
        requestRef.current = null;
        setPending(false);
        setAgentStatus("thinking");
        onStreamingChange(false);
        resumeDeferredCameraDialogue();
      }
    }
  };

  const inlineComposerOpen = composerOpen && !expanded;
  const openReply = () => {
    if (expanded) formRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    else setComposerOpen(true);
  };

  const composer = <AgentComposer expanded={expanded} pending={pending} draft={draft} setDraft={setDraft} attachments={attachments} onSubmit={submit} onCancel={() => setComposerOpen(false)} formRef={formRef} />;

  const showFreeDialogueBack = !guidedTourActive
    && fixedCameraDialogueActive
    && introPhase === "free"
    && scriptSegmentIndex > 0;

  const isAreaTourPhase = (isSanDiegoTourPhase(introPhase) && introPhase !== "san_diego_next")
    || ["union_next", "carlyle_next", "shift_next", "washington_next", "lipton_next", "bobst_next", "stern_next", "courant_next"].includes(introPhase);
  const continueAreaTour = () => {
    if (presentationAction === "next") return requestNextMessage();
    if (isSanDiegoTourPhase(introPhase)) return continueSanDiegoTour();
    const continuations: Partial<Record<IntroPhase, () => void>> = {
      union_next: continueUnionTour,
      carlyle_next: continueFromCarlyle,
      shift_next: continueFromShift,
      washington_next: continueWashingtonTour,
      lipton_next: continueFromLipton,
      bobst_next: continueFromBobst,
      stern_next: continueFromStern,
      courant_next: continueFromCourant,
    };
    continuations[introPhase]?.();
  };

  return (
    <div
      className={`agent-chat${dockedCaptionVisible ? " agent-chat--docked-visible" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className="agent-chat__messages"
        role="log"
        aria-live={captionStreaming ? "off" : "polite"}
        ref={messageListRef}
        onScroll={constrainCaptionScroll}
      >
        {messages.flatMap((message, messageIndex) => message.role === "assistant" ? [{ message, messageIndex }] : [])
          .map(({ message, messageIndex }, index, assistantMessages) => (
          <div key={`exchange-${messageIndex}`} className="agent-chat__exchange">
            <AgentUserMessage message={messages[messageIndex - 1]} />
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
                {inlineComposerOpen ? (
                  composer
                ) : (
                  <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                    <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                  </button>
                )}
              </div>
            )}
            {index === assistantMessages.length - 1 && introPhase === "declined" && !pending && presentationAction === null && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(finishDecline)}>Okay</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && (introPhase === "globe_choice" || introPhase === "manhattan_choice") && !pending && !captionStreaming && presentationAction === null && !inlineComposerOpen && (
              <TourDestinationChoices
                level={introPhase === "globe_choice" ? "city" : "neighborhood"}
                onChooseNewYork={() => runAfterDockedCaptionFade(chooseNewYork)}
                onChooseSanDiego={() => runAfterDockedCaptionFade(() => navigateSanDiegoTour("san-diego"))}
                onChooseNeighborhood={(destination) => runAfterDockedCaptionFade(() => chooseManhattanNeighborhood(destination))}
                onReply={openReply}
              />
            )}
            {index === assistantMessages.length - 1 && introPhase === "san_diego_next" && !pending && presentationAction === null && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices agent-chat__choices--white" aria-label="Choose a San Diego neighborhood" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => navigateSanDiegoTour("torrey-highlands"))}>Torrey Highlands</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => navigateSanDiegoTour("park-village"))}>Park Village</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => navigateSanDiegoTour("torrey-pines"))}>Torrey Pines</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(returnToPreviousTourStop)}>Back</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && isAreaTourPhase && !pending && presentationAction !== "reply" && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices" aria-label="Continue the tour" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(continueAreaTour)}>Next</button>
                  <button type="button" className="agent-chat__choice--secondary" onClick={() => runAfterDockedCaptionFade(returnToPreviousTourStop)}>Back</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && introPhase === "san_diego_complete" && !pending && presentationAction === null && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices agent-chat__choices--white" aria-label="Choose where to go after San Diego">
                  <button type="button" onClick={() => runAfterDockedCaptionFade(chooseNewYork)}>New York</button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => navigateSanDiegoTour("globe"))}>Globe</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && introPhase === "tour_location_choice" && !pending && presentationAction === null && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div
                  className="agent-chat__choices agent-chat__choices--white"
                  aria-label="Choose whether to visit the other tour location"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button type="button" onClick={() => runAfterDockedCaptionFade(moveToOtherTourLocation)}>
                    {nextTourLocation === "union" ? "Union Square" : "Washington Square"}
                  </button>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(() => { finishGuidedTour(); onMinimize(); })}>Done</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && showFreeDialogueBack && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className="agent-chat__choices">
                  {presentationAction === "next" && (
                    <button type="button" onClick={() => runAfterDockedCaptionFade(requestNextMessage)}>Next</button>
                  )}
                  <button type="button" className="agent-chat__choice--secondary" onClick={() => runAfterDockedCaptionFade(returnToPreviousFreeSegment)}>Back</button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {index === assistantMessages.length - 1 && presentationAction && !(isAreaTourPhase && presentationAction === "next") && !showFreeDialogueBack && !inlineComposerOpen && (
              <div className="agent-chat__caption-actions">
                <div className={`agent-chat__choices${presentationAction === "reply" ? " agent-chat__choices--white" : ""}`}>
                  <button type="button" onClick={() => runAfterDockedCaptionFade(presentationAction === "next" ? requestNextMessage : onMinimize)}>
                    {presentationAction === "next" ? "Next" : "Done"}
                  </button>
                </div>
                <button type="button" className="agent-chat__inline-reply" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openReply(); }}>
                  <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
                </button>
              </div>
            )}
            {!expanded && index === assistantMessages.length - 1 && !pending && !(inlineComposerOpen && introPhase === "choice" && presentationAction === null) && (inlineComposerOpen || (!showFreeDialogueBack && introPhase !== "greeting" && introPhase !== "choice" && introPhase !== "declined" && introPhase !== "globe_arrival" && introPhase !== "globe_choice" && introPhase !== "touring" && introPhase !== "manhattan_arrival" && introPhase !== "manhattan_choice" && introPhase !== "union_next" && introPhase !== "carlyle_next" && introPhase !== "shift_next" && introPhase !== "washington_next" && introPhase !== "lipton_next" && introPhase !== "bobst_next" && introPhase !== "stern_next" && introPhase !== "courant_next" && introPhase !== "tour_location_choice" && !isSanDiegoTourPhase(introPhase) && introPhase !== "san_diego_complete" && introPhase !== "camera_dialogue_streaming" && presentationAction === null)) && (
              inlineComposerOpen ? (
                composer
              ) : (
                <button
                  type="button"
                  className="agent-chat__inline-reply"
                  onClick={() => openReply()}
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
        <AgentUserMessage message={messages.at(-1)} />
        {error && <p className="agent-chat__error">{error}</p>}
        <div className="agent-chat__scroll-room" aria-hidden="true" />
      </div>
      {expanded && composer}
    </div>
  );
}
