import type { MapDestination } from "@/agent/contracts/types";
import {
  bobstLibraryDialogue, courantInstituteDialogue, liptonHallDialogue, manhattanDialogue,
  mesaVerdeDialogue, deerCanyonDialogue, torreyHighlandsDialogue, sternSchoolOfBusinessDialogue, torreyHighlandsPlazaDialogue,
  twentyFiveUnionSquareWestDialogue, twoThirtyFiveParkAvenueSouthDialogue,
  unionSquareDialogue, washingtonSquareDialogue, westviewHighSchoolDialogue,
} from "./index";

export type IntroPhase = "greeting" | "choice" | "declining" | "declined" | "globe_arrival" | "globe_choice" | "touring" | "manhattan_arrival" | "manhattan_choice" | "union_next" | "carlyle_next" | "shift_next" | "washington_arrival" | "washington_next" | "lipton_arrival" | "lipton_next" | "bobst_arrival" | "bobst_next" | "stern_next" | "courant_next" | "tour_location_choice" | "san_diego_next" | "westview_next" | "plaza_next" | "mesa_verde_next" | "deer_canyon_next" | "san_diego_complete" | "camera_dialogue_streaming" | "free";

export const SAN_DIEGO_STOPS = {
  "san-diego": { content: torreyHighlandsDialogue, phase: "san_diego_next", next: "westview-high-school", previous: "globe" },
  "westview-high-school": { content: westviewHighSchoolDialogue, phase: "westview_next", next: "torrey-highlands-plaza", previous: "san-diego" },
  "torrey-highlands-plaza": { content: torreyHighlandsPlazaDialogue, phase: "plaza_next", next: "mesa-verde-middle-school", previous: "westview-high-school" },
  "mesa-verde-middle-school": { content: mesaVerdeDialogue, phase: "mesa_verde_next", next: "deer-canyon-elementary-school", previous: "torrey-highlands-plaza" },
  "deer-canyon-elementary-school": { content: deerCanyonDialogue, phase: "deer_canyon_next", next: null, previous: "mesa-verde-middle-school" },
} as const satisfies Partial<Record<MapDestination, { content: string; phase: IntroPhase; next: MapDestination | null; previous: MapDestination }>>;

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
