import { AGENT_ATTACHMENTS_MAX_BYTES, AGENT_FILE_MAX_BYTES, AGENT_IMAGE_MAX_BYTES, AGENT_IMAGES_PER_REQUEST, type AgentFile, type AgentImage, type AgentMessage } from "@/agent/contracts/types";

export const IMAGE_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1600;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file: Pick<File, "type" | "size">) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (!file.size || file.size > IMAGE_SOURCE_MAX_BYTES) throw new Error("Choose an image smaller than 10 MB.");
}

export function fitImageDimensions(width: number, height: number, maxEdge = IMAGE_MAX_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("This image could not be read.");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareAgentImage(file: File): Promise<AgentImage> {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be read. Try another image."));
      image.src = url;
    });
    let { width, height } = fitImageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image attachments are unavailable in this browser.");
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", Math.max(0.45, 0.88 - attempt * 0.07)));
      if (!blob) throw new Error("This image could not be prepared.");
      if (blob.size <= AGENT_IMAGE_MAX_BYTES) return { name: file.name.trim().slice(0, 200) || "Pasted image.jpg", dataUrl: await blobDataUrl(blob) };
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }
    throw new Error("This image is too large. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
    image.src = "";
  }
}

export function attachmentBytes(attachment: AgentImage | AgentFile) {
  const encoded = attachment.dataUrl.slice(attachment.dataUrl.indexOf(",") + 1);
  return Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

export async function prepareAgentAttachment(file: File): Promise<{ image: AgentImage } | { file: AgentFile }> {
  if (file.type.startsWith("image/")) {
    try { return { image: await prepareAgentImage(file) }; }
    catch (error) { if (IMAGE_TYPES.has(file.type)) throw error; }
  }
  if (file.size > AGENT_FILE_MAX_BYTES) throw new Error("Files must be 1 MB or smaller. Images can be up to 10 MB before resizing.");
  if (!file.size) throw new Error("This file is empty. Choose a file with content.");
  const dataUrl = await blobDataUrl(file);
  return { file: { name: file.name.trim().slice(0, 200) || "Attachment", dataUrl } };
}

// Keep the visible transcript intact while bounding the bytes sent with history.
export function prepareAgentRequestMessages(messages: AgentMessage[]): AgentMessage[] {
  let attachmentsLeft = AGENT_IMAGES_PER_REQUEST;
  let bytesLeft = AGENT_ATTACHMENTS_MAX_BYTES;
  let textLeft = 20_000;
  return messages.slice(-20).reverse().flatMap((message): AgentMessage[] => {
    const content = message.content.slice(0, Math.min(4_000, textLeft));
    textLeft -= content.length;
    const images: AgentImage[] = [];
    const files: AgentFile[] = [];
    if (message.role === "user") {
      const attachments = [...(message.images ?? []).map((image) => ({ kind: "image", value: image })), ...(message.files ?? []).map((file) => ({ kind: "file", value: file }))];
      for (const attachment of attachments.reverse()) {
        const bytes = attachmentBytes(attachment.value);
        if (!attachmentsLeft || bytes > bytesLeft) continue;
        (attachment.kind === "image" ? images : files).unshift(attachment.value);
        attachmentsLeft--;
        bytesLeft -= bytes;
      }
    }
    if (!content.trim() && !images.length && !files.length) return [];
    return [{ role: message.role, content, ...(images.length ? { images } : {}), ...(files.length ? { files } : {}) }];
  }).reverse();
}
