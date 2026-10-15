import type { AgentFile } from "./types";

export type AgentFileKind = "document" | "text" | "unsupported";

const DOCUMENT_MIMES: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf", odt: "application/vnd.oasis.opendocument.text", ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", tsv: "text/tab-separated-values",
  txt: "text/plain", md: "text/markdown", json: "application/json", html: "text/html", htm: "text/html", xml: "application/xml",
};
const CODE_EXTENSIONS = new Set(["c", "cc", "cpp", "cs", "css", "go", "h", "hpp", "java", "js", "jsx", "kt", "lua", "m", "mjs", "cjs", "php", "pl", "py", "r", "rb", "rs", "scala", "sh", "sql", "swift", "tex", "ts", "tsx", "vue", "yaml", "yml"]);

function documentMime(name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  return Object.hasOwn(DOCUMENT_MIMES, extension)
    ? DOCUMENT_MIMES[extension]
    : CODE_EXTENSIONS.has(extension) ? "text/plain" : undefined;
}

/** Decode unknown files as strict UTF-8 only. Binary files never become model text. */
export function getAgentFileText(dataUrl: string): string | null {
  try {
    const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.includes(0)) return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Shared browser/server classification, so attachment chips describe actual support. */
export function getAgentFileKind(name: string, dataUrl: string): AgentFileKind {
  if (documentMime(name)) return "document";
  return getAgentFileText(dataUrl) === null ? "unsupported" : "text";
}

/** Browsers commonly omit MIME or report octet-stream; infer it for supported formats. */
export function getAgentFileDataUrl(file: AgentFile): string {
  const mime = documentMime(file.name);
  return mime ? `data:${mime};base64,${file.dataUrl.slice(file.dataUrl.indexOf(",") + 1)}` : file.dataUrl;
}
