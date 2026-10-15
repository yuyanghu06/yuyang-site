import { memo, useRef, useState, type FormEvent, type RefObject } from "react";
import { AGENT_ATTACHMENTS_MAX_BYTES, AGENT_IMAGES_PER_MESSAGE, type AgentFile, type AgentImage, type AgentMessage } from "@/agent/contracts/types";
import { getAgentFileKind } from "@/agent/contracts/files";
import { attachmentBytes, prepareAgentAttachment } from "./agent-images";

export function useAgentAttachments() {
  const [images, setImages] = useState<AgentImage[]>([]);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [imageError, setImageError] = useState("");
  const busyRef = useRef(false);
  const count = images.length + files.length;
  const addFiles = async (selected: File[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProcessing(true);
    setImageError("");
    const available = AGENT_IMAGES_PER_MESSAGE - count;
    const preparedImages: AgentImage[] = [];
    const preparedFiles: AgentFile[] = [];
    const errors: string[] = [];
    let bytes = [...images, ...files].reduce((total, attachment) => total + attachmentBytes(attachment), 0);
    if (selected.length > available) errors.push(`Attach up to ${AGENT_IMAGES_PER_MESSAGE} files per message.`);
    try {
      for (const file of selected.slice(0, available)) {
        try {
          const prepared = await prepareAgentAttachment(file);
          const attachment = "image" in prepared ? prepared.image : prepared.file;
          const size = attachmentBytes(attachment);
          if (bytes + size > AGENT_ATTACHMENTS_MAX_BYTES) { errors.push("Attachments must total 2 MB or less per message."); continue; }
          bytes += size;
          if ("image" in prepared) preparedImages.push(prepared.image);
          else preparedFiles.push(prepared.file);
        } catch (reason) { errors.push(reason instanceof Error ? reason.message : "This file could not be prepared."); }
      }
      setImages((current) => [...current, ...preparedImages]);
      setFiles((current) => [...current, ...preparedFiles]);
      setImageError([...new Set(errors)].join(" "));
    } finally {
      busyRef.current = false;
      setProcessing(false);
    }
  };
  return {
    images, files, count, processing, imageError, addFiles,
    clear: () => { setImages([]); setFiles([]); setImageError(""); },
    removeImage: (index: number) => setImages((current) => current.filter((_, i) => i !== index)),
    removeFile: (index: number) => setFiles((current) => current.filter((_, i) => i !== index)),
  };
}

type ComposerProps = {
  expanded: boolean;
  pending: boolean;
  draft: string;
  setDraft: (value: string) => void;
  attachments: ReturnType<typeof useAgentAttachments>;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  formRef: RefObject<HTMLFormElement | null>;
};

const FileLabel = memo(function FileLabel({ file }: { file: AgentFile }) {
  return <span className="agent-chat__file-label"><span>{file.name}</span>{getAgentFileKind(file.name, file.dataUrl) === "unsupported" && <small>Content unavailable for this file type</small>}</span>;
});

export function AgentComposer({ expanded, pending, draft, setDraft, attachments, onSubmit, onCancel, formRef }: ComposerProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const disabled = pending || attachments.processing;
  return (
    <form className={`agent-chat__form agent-chat__form--${expanded ? "expanded" : "inline"}`} onSubmit={onSubmit} ref={formRef}>
      {attachments.count > 0 && <div className="agent-chat__attachments" aria-label="Attached files">
        {attachments.images.map((image, index) => <div className="agent-chat__attachment" key={`image-${index}-${image.name}`}>
          {/* Local image bytes need no remote optimizer or upload. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt={image.name} />
          <button type="button" onClick={() => attachments.removeImage(index)} disabled={disabled} aria-label={`Remove ${image.name}`}>×</button>
        </div>)}
        {attachments.files.map((file, index) => <div className="agent-chat__attachment agent-chat__attachment--file" key={`file-${index}-${file.name}`}>
          <FileLabel file={file} /><button type="button" onClick={() => attachments.removeFile(index)} disabled={disabled} aria-label={`Remove ${file.name}`}>×</button>
        </div>)}
      </div>}
      <input className="agent-chat__image-picker" type="file" multiple hidden ref={pickerRef} tabIndex={-1} aria-label="Choose files" onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (!disabled) void attachments.addFiles(files);
      }} />
      <div className="agent-chat__input-row">
        <button type="button" className="agent-chat__attach" onClick={() => pickerRef.current?.click()} disabled={disabled || attachments.count >= AGENT_IMAGES_PER_MESSAGE} aria-label="Attach files" title="Attach files">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <input type="text" id="agent-chat-input" aria-label="Message Yuyang" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4_000} placeholder="Message Yuyang…" disabled={pending} autoFocus={!expanded} onPaste={(event) => {
          const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file").flatMap((item) => { const file = item.getAsFile(); return file ? [file] : []; });
          if (files.length && !disabled) { event.preventDefault(); void attachments.addFiles(files); }
        }} />
        <button type="submit" disabled={disabled || (!draft.trim() && !attachments.count)} aria-label="Send message">↑</button>
        {!expanded && <button type="button" className="agent-chat__composer-cancel" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onCancel(); }}>Cancel</button>}
      </div>
      {attachments.processing && <p className="agent-chat__attachment-status" role="status">Preparing attachments…</p>}
      {attachments.imageError && <p className="agent-chat__attachment-status" role="alert">{attachments.imageError}</p>}
    </form>
  );
}

export function AgentUserMessage({ message }: { message?: AgentMessage }) {
  if (message?.role !== "user") return null;
  return <div className="agent-chat__message agent-chat__message--user">
    {message.images?.length ? <div className="agent-chat__sent-images">{message.images.map((image, index) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image.dataUrl} alt={image.name} key={`${index}-${image.name}`} />
    ))}</div> : null}
    {message.files?.length ? <div className="agent-chat__sent-files">{message.files.map((file, index) => <FileLabel file={file} key={`${index}-${file.name}`} />)}</div> : null}
    {message.content}
  </div>;
}
