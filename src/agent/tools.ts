import type { FunctionTool } from "openai/resources/responses/responses";
import { CAMERA_VIEWS } from "./camera-views";
import { AVATAR_EMOTES, MAP_DESTINATIONS, type AgentCommand, type AvatarEmote, type MapDestination } from "./types";

export const AGENT_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "navigate_map",
    description: `Move the persistent map camera to one authored view. Available views: ${CAMERA_VIEWS.map((view) => `${view.id} (${view.label})`).join(", ")}.`,
    strict: true,
    parameters: {
      type: "object",
      properties: { destination: { type: "string", enum: [...MAP_DESTINATIONS] } },
      required: ["destination"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "trigger_avatar_emote",
    description: "Ask the avatar to play one approved semantic one-shot emote.",
    strict: true,
    parameters: {
      type: "object",
      properties: { emote: { type: "string", enum: [...AVATAR_EMOTES] } },
      required: ["emote"],
      additionalProperties: false,
    },
  },
];

function hasString(value: unknown, key: string): value is Record<string, string> {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[key] === "string";
}

export function parseAgentCommand(name: string, rawArguments: string): AgentCommand {
  let argumentsValue: unknown;
  try {
    argumentsValue = JSON.parse(rawArguments);
  } catch {
    throw new Error(`Tool ${name} supplied invalid JSON.`);
  }
  if (name === "navigate_map" && hasString(argumentsValue, "destination")
    && MAP_DESTINATIONS.includes(argumentsValue.destination as MapDestination)) {
    return { type: "navigate_map", destination: argumentsValue.destination as MapDestination };
  }
  if (name === "trigger_avatar_emote" && hasString(argumentsValue, "emote")
    && AVATAR_EMOTES.includes(argumentsValue.emote as AvatarEmote)) {
    return { type: "trigger_avatar_emote", emote: argumentsValue.emote as AvatarEmote };
  }
  throw new Error(`Tool ${name} supplied unsupported arguments.`);
}
