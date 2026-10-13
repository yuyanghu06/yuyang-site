import type { MapDestination } from "@/agent/contracts/types";
import {
  bobstLibraryDialogue, courantInstituteDialogue, liptonHallDialogue, manhattanDialogue,
  sanDiegoDialogue, sternSchoolOfBusinessDialogue, torreyHighlandsPlazaDialogue,
  torreyHighlandsDialogue, torreyPinesDialogue, parkVillageDialogue,
  twentyFiveUnionSquareWestDialogue, twoThirtyFiveParkAvenueSouthDialogue,
  unionSquareDialogue, washingtonSquareDialogue, westviewHighSchoolDialogue,
} from "./index";

export type IntroPhase = "greeting" | "choice" | "declining" | "declined" | "touring" | "manhattan_arrival" | "manhattan_choice" | "union_next" | "carlyle_next" | "shift_next" | "washington_arrival" | "washington_next" | "lipton_arrival" | "lipton_next" | "bobst_arrival" | "bobst_next" | "stern_next" | "courant_next" | "tour_location_choice" | "san_diego_next" | "torrey_highlands_next" | "torrey_pines_next" | "park_village_next" | "westview_next" | "plaza_next" | "san_diego_complete" | "camera_dialogue_streaming" | "free";

export const SAN_DIEGO_STOPS = {
  "san-diego": { content: sanDiegoDialogue, phase: "san_diego_next", next: "torrey-highlands", previous: "globe" },
  "torrey-highlands": { content: torreyHighlandsDialogue, phase: "torrey_highlands_next", next: "westview-high-school", previous: "san-diego" },
  "torrey-pines": { content: torreyPinesDialogue, phase: "torrey_pines_next", next: "park-village", previous: "torrey-highlands-plaza" },
  "park-village": { content: parkVillageDialogue, phase: "park_village_next", next: null, previous: "torrey-pines" },
  "westview-high-school": { content: westviewHighSchoolDialogue, phase: "westview_next", next: "torrey-highlands-plaza", previous: "torrey-highlands" },
  "torrey-highlands-plaza": { content: torreyHighlandsPlazaDialogue, phase: "plaza_next", next: "torrey-pines", previous: "westview-high-school" },
} as const satisfies Partial<Record<MapDestination, { content: string; phase: IntroPhase; next: MapDestination | null; previous: MapDestination }>>;

export const isSanDiegoTourPhase = (phase: IntroPhase) => Object.values(SAN_DIEGO_STOPS).some((stop) => stop.phase === phase);

export const getSanDiegoStop = (view: MapDestination) => view in SAN_DIEGO_STOPS
  ? SAN_DIEGO_STOPS[view as keyof typeof SAN_DIEGO_STOPS]
  : undefined;

export const LANDMARK_DIALOGUES: Partial<Record<MapDestination, { content: string; phase: IntroPhase }>> = {
  "bobst-library": { content: bobstLibraryDialogue, phase: "bobst_next" },
  "stern-school-of-business": { content: sternSchoolOfBusinessDialogue, phase: "stern_next" },
  "courant-institute": { content: courantInstituteDialogue, phase: "courant_next" },
  "25-union-square-west": { content: twentyFiveUnionSquareWestDialogue, phase: "carlyle_next" },
  "235-park-avenue-south": { content: twoThirtyFiveParkAvenueSouthDialogue, phase: "shift_next" },
};

const TOUR_OVERVIEWS: Partial<Record<MapDestination, { content: string; phase: IntroPhase }>> = {
  manhattan: { content: manhattanDialogue, phase: "manhattan_choice" },
  union: { content: unionSquareDialogue, phase: "union_next" },
  washington: { content: washingtonSquareDialogue, phase: "washington_next" },
  "lipton-hall": { content: liptonHallDialogue, phase: "lipton_next" },
};

export const getPreviousTourStop = (view: MapDestination) => getSanDiegoStop(view)
  ?? LANDMARK_DIALOGUES[view] ?? TOUR_OVERVIEWS[view];
