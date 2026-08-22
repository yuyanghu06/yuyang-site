import { CAMERA_VIEW_IDS, type CameraViewId } from "./camera-views";

export const MAP_DESTINATIONS = CAMERA_VIEW_IDS;
export type MapDestination = CameraViewId;

export const AVATAR_EMOTES = ["wave_hello", "smile_tap", "thumbs_up", "point_right", "sad", "thumbs_down"] as const;
export type AvatarEmote = (typeof AVATAR_EMOTES)[number];

export type AgentCommand =
  | { type: "navigate_map"; destination: MapDestination }
  | { type: "trigger_avatar_emote"; emote: AvatarEmote }
  | { type: "display_blue" }
  | { type: "display_white" };

export type AgentMessage = { role: "user" | "assistant"; content: string };
export type RagCitation = { id: string; source: string; score: number };
export type AgentReply = { message: AgentMessage; commands: AgentCommand[]; citations: RagCitation[] };
export type AgentStreamEvent =
  | { type: "sources"; citations: RagCitation[] }
  | { type: "speech_start" }
  | { type: "text_delta"; delta: string }
  | { type: "command"; command: AgentCommand }
  | { type: "done" }
  | { type: "error"; message: string };

export const AGENT_COMMAND_EVENT = "yuyang:agent-command";
export const MAP_VIEW_SETTLED_EVENT = "yuyang:map-view-settled";

export type MapViewSettledDetail = { view: MapDestination };

export function dispatchAgentCommand(command: AgentCommand) {
  window.dispatchEvent(new CustomEvent<AgentCommand>(AGENT_COMMAND_EVENT, { detail: command }));
}

export function dispatchMapViewSettled(view: MapDestination) {
  window.dispatchEvent(new CustomEvent<MapViewSettledDetail>(MAP_VIEW_SETTLED_EVENT, { detail: { view } }));
}

export function createMapViewSettledReporter() {
  let previous: MapDestination | null = null;
  return (view: MapDestination | null) => {
    if (view && view !== previous) dispatchMapViewSettled(view);
    previous = view;
  };
}
