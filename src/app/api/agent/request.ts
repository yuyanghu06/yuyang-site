import {
  AGENT_IMAGE_MAX_BYTES, AGENT_FILE_MAX_BYTES, AGENT_ATTACHMENTS_MAX_BYTES, AGENT_IMAGES_PER_MESSAGE, AGENT_IMAGES_PER_REQUEST,
  MAP_DESTINATIONS, type AgentFile, type AgentImage, type AgentMessage, type MapDestination,
} from "@/agent/contracts/types";

export const AGENT_REQUEST_MAX_BYTES = 3 * 1024 * 1024;

export class AgentRequestError extends Error {
  constructor(message: string, public readonly status: 400 | 413 = 400) { super(message); }
}

// Count bytes while reading, even when Content-Length is absent or inaccurate.
export async function readAgentRequest(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > AGENT_REQUEST_MAX_BYTES) {
    await request.body?.cancel();
    throw new AgentRequestError("Message and attachments are too large. Please send fewer or smaller files.", 413);
  }
  if (!request.body) throw new AgentRequestError("Request body must be valid JSON.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteCount = 0;
  let json = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > AGENT_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new AgentRequestError("Message and attachments are too large. Please send fewer or smaller files.", 413);
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
    return JSON.parse(json);
  } catch (error) {
    if (error instanceof AgentRequestError) throw error;
    throw new AgentRequestError("Request body must be valid JSON.");
  } finally {
    reader.releaseLock();
  }
}

function parseImage(value: unknown): AgentImage {
  if (typeof value !== "object" || value === null) throw new AgentRequestError("Invalid image attachment.");
  const image = value as Record<string, unknown>;
  if (typeof image.name !== "string" || !image.name.trim() || image.name.length > 200 || typeof image.dataUrl !== "string") {
    throw new AgentRequestError("Each image needs a name of 1–200 characters and image data.");
  }
  if (image.dataUrl.length > Math.ceil(AGENT_IMAGE_MAX_BYTES / 3) * 4 + 32) {
    throw new AgentRequestError("Each image must be 512 KiB or smaller.", 413);
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if (!match) throw new AgentRequestError("Images must be JPEG, PNG, or WebP data.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.toString("base64") !== match[2]) throw new AgentRequestError("Invalid image encoding.");
  if (bytes.length > AGENT_IMAGE_MAX_BYTES) throw new AgentRequestError("Each image must be 512 KiB or smaller.", 413);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!({ jpeg: isJpeg, png: isPng, webp: isWebp }[match[1]])) throw new AgentRequestError("Image data does not match its format.");
  return { name: image.name.trim(), dataUrl: image.dataUrl };
}

function parseFile(value: unknown): AgentFile {
  if (typeof value !== "object" || value === null) throw new AgentRequestError("Invalid file attachment.");
  const file = value as Record<string, unknown>;
  if (typeof file.name !== "string" || !file.name.trim() || file.name.length > 200 || typeof file.dataUrl !== "string") {
    throw new AgentRequestError("Each file needs a name of 1–200 characters and file data.");
  }
  if (file.dataUrl.length > Math.ceil(AGENT_FILE_MAX_BYTES / 3) * 4 + 256) {
    throw new AgentRequestError("Each file must be 1 MiB or smaller.", 413);
  }
  const match = /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(file.dataUrl);
  if (!match || (match[1]?.length ?? 0) > 200) throw new AgentRequestError("Files must contain base64 file data.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.toString("base64") !== match[2]) throw new AgentRequestError("Invalid file encoding.");
  if (bytes.length > AGENT_FILE_MAX_BYTES) throw new AgentRequestError("Each file must be 1 MiB or smaller.", 413);
  if (/\.pdf$/i.test(file.name.trim()) && bytes.toString("ascii", 0, 5) !== "%PDF-") {
    throw new AgentRequestError("PDF data does not match its format.");
  }
  return { name: file.name.trim(), dataUrl: file.dataUrl };
}

export function parseAgentRequest(value: unknown): { messages: AgentMessage[]; currentView: MapDestination } {
  const invalid = () => new AgentRequestError("Invalid agent request.");
  if (typeof value !== "object" || value === null) throw invalid();
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) throw invalid();
  if (typeof body.currentView !== "string" || !MAP_DESTINATIONS.includes(body.currentView as MapDestination)) throw invalid();
  const messages: AgentMessage[] = [];
  let attachmentCount = 0;
  let attachmentBytes = 0;
  for (const candidate of body.messages) {
    if (typeof candidate !== "object" || candidate === null) throw invalid();
    const message = candidate as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") throw invalid();
    let images: AgentImage[] | undefined;
    let files: AgentFile[] | undefined;
    for (const key of ["images", "files"] as const) {
      if (key in message && (message.role !== "user" || !Array.isArray(message[key]))) {
        throw new AgentRequestError("Only visitor messages can contain attachment arrays.");
      }
    }
    const rawImages = message.images as unknown[] | undefined;
    const rawFiles = message.files as unknown[] | undefined;
    const count = (rawImages?.length ?? 0) + (rawFiles?.length ?? 0);
    if (count > AGENT_IMAGES_PER_MESSAGE) throw new AgentRequestError("Attach up to 3 images or files per message.");
    attachmentCount += count;
    if (attachmentCount > AGENT_IMAGES_PER_REQUEST) throw new AgentRequestError("This conversation can send up to 4 attachments at a time.");
    images = rawImages?.map(parseImage);
    files = rawFiles?.map(parseFile);
    for (const attachment of [...(images ?? []), ...(files ?? [])]) {
      attachmentBytes += Buffer.byteLength(attachment.dataUrl.slice(attachment.dataUrl.indexOf(",") + 1), "base64");
    }
    if (attachmentBytes > AGENT_ATTACHMENTS_MAX_BYTES) throw new AgentRequestError("Attachments must total 2 MiB or less.", 413);
    const content = message.content.trim();
    if ((!content && !count) || content.length > 4_000) throw invalid();
    messages.push({ role: message.role, content, ...(images?.length ? { images } : {}), ...(files?.length ? { files } : {}) });
  }
  if (messages.at(-1)?.role !== "user" || messages.reduce((total, message) => total + message.content.length, 0) > 20_000) throw invalid();
  return { messages, currentView: body.currentView as MapDestination };
}
