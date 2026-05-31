"use client";

// Right pane: a reply on the RFQ's original email thread, with the received
// message shown read-only above an editable composer. The generated quote PDF
// is auto-attached (chip removable / re-addable). "Send Quote" is stubbed — it
// hands a payload up to send-client, which logs it and shows the confirmation.

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@uptool/ui";
import {
  AlertTriangle,
  Bold,
  ChevronDown,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Paperclip,
  RemoveFormatting,
  Send,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import * as React from "react";
import { type OriginalEmail, defaultReplyBody } from "./send-stub";

export interface SendUserFile {
  name: string;
  size: number;
  type: string;
}

export interface SendPayload {
  to: string[];
  cc: string[];
  bcc: string[];
  bodyText: string;
  bodyHtml: string;
  /** Whether the auto-generated quote PDF is attached. */
  quoteAttached: boolean;
  /** Files the user attached from their computer. */
  userFiles: SendUserFile[];
}

interface Props {
  original: OriginalEmail;
  customerEmail: string;
  contactName: string;
  quoteNumber: number;
  /** Attachment chip label, e.g. "We Mill You Chill Quote 1194". */
  attachmentName: string;
  /** Size of the generated quote PDF in bytes (for the 25 MB total budget). */
  quoteBytes: number;
  onSend: (payload: SendPayload) => void;
}

interface UserAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const fmtMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function dedupe(emails: string[]): string[] {
  return [...new Set(emails.filter(Boolean))];
}

export function EmailComposer({
  original,
  customerEmail,
  contactName,
  quoteNumber,
  attachmentName,
  quoteBytes,
  onSend,
}: Props) {
  const [to, setTo] = React.useState<string[]>(() =>
    dedupe([original.replyFromEmail, customerEmail]),
  );
  const [cc, setCc] = React.useState<string[]>([]);
  const [bcc, setBcc] = React.useState<string[]>([]);
  const [showCc, setShowCc] = React.useState(false);
  const [showBcc, setShowBcc] = React.useState(false);
  // The auto-generated quote PDF (system-managed) is tracked separately from
  // files the user attaches from their computer.
  const [quoteAttached, setQuoteAttached] = React.useState(true);
  const [userAttachments, setUserAttachments] = React.useState<UserAttachment[]>([]);
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);
  const defaultBody = defaultReplyBody(contactName, quoteNumber);

  const usedBytes =
    (quoteAttached ? quoteBytes : 0) + userAttachments.reduce((s, a) => s + a.size, 0);

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const errors: string[] = [];
    const added: UserAttachment[] = [];
    let running = usedBytes;
    for (const file of picked) {
      if (file.size > MAX_TOTAL_BYTES) {
        errors.push(`“${file.name}” (${fmtMb(file.size)}) exceeds the 25 MB limit.`);
        continue;
      }
      if (running + file.size > MAX_TOTAL_BYTES) {
        errors.push(
          `Adding “${file.name}” would exceed the 25 MB total (currently ${fmtMb(running)}).`,
        );
        continue;
      }
      running += file.size;
      added.push({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type });
    }
    if (added.length) setUserAttachments((prev) => [...prev, ...added]);
    setAttachError(errors.length ? errors.join(" ") : null);
    e.target.value = ""; // allow re-picking the same file
  }

  function removeUserAttachment(id: string) {
    setUserAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachError(null);
  }

  // Seed the contentEditable once (uncontrolled to avoid caret jumps).
  React.useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.textContent = defaultBody;
      initialized.current = true;
    }
  }, [defaultBody]);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function handleSend() {
    const el = editorRef.current;
    onSend({
      to,
      cc,
      bcc,
      bodyText: el?.innerText ?? defaultBody,
      bodyHtml: el?.innerHTML ?? "",
      quoteAttached,
      userFiles: userAttachments.map(({ name, size, type }) => ({ name, size, type })),
    });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Reply header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-[13px]">
        <span className="font-medium text-gray-700">Replying to last email</span>
        <span className="text-gray-400">{original.dateLabel}</span>
        <span className="flex items-center gap-1 text-gray-400">
          <span className="rounded bg-gray-100 px-1 py-0.5 font-medium text-gray-500">from:</span>
          <span className="text-gray-500">{original.replyFromEmail}</span>
          {original.replyFromUnverified && (
            <span title="This reply-from address needs verification">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
        </span>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Reply options"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => console.log("TODO: view original email")}>
                View Original
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => console.log("TODO: reply to another email")}>
                Reply to another email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Original received email (read-only) — the RFQ thread's last message */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="rounded-lg bg-[hsl(214_32%_97%)] p-4 text-[13px] leading-relaxed text-gray-700">
          {original.bodyText ? (
            <p className="whitespace-pre-wrap">{original.bodyText}</p>
          ) : (
            <p className="italic text-gray-400">(No message body)</p>
          )}
          {original.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {original.attachments.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                >
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-gray-200">
        <ChipRow
          label="To:"
          emails={to}
          onRemove={(e) => setTo((prev) => prev.filter((x) => x !== e))}
          onAdd={(e) => setTo((prev) => dedupe([...prev, e]))}
          trailing={
            <div className="flex items-center gap-3">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-[13px] text-[#2563EB] hover:underline"
                >
                  +Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="text-[13px] text-[#2563EB] hover:underline"
                >
                  +Bcc
                </button>
              )}
            </div>
          }
        />
        {showCc && (
          <ChipRow
            label="Cc:"
            emails={cc}
            onRemove={(e) => setCc((prev) => prev.filter((x) => x !== e))}
            onAdd={(e) => setCc((prev) => dedupe([...prev, e]))}
          />
        )}
        {showBcc && (
          <ChipRow
            label="Bcc:"
            emails={bcc}
            onRemove={(e) => setBcc((prev) => prev.filter((x) => x !== e))}
            onAdd={(e) => setBcc((prev) => dedupe([...prev, e]))}
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100"
              >
                Normal <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onSelect={() => exec("formatBlock", "<p>")}>Normal</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exec("formatBlock", "<h2>")}>
                Heading
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exec("formatBlock", "<h3>")}>
                Subheading
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <ToolbarButton label="Bold" icon={Bold} onClick={() => exec("bold")} />
          <ToolbarButton label="Italic" icon={Italic} onClick={() => exec("italic")} />
          <ToolbarButton label="Underline" icon={Underline} onClick={() => exec("underline")} />
          <ToolbarButton
            label="Link"
            icon={Link2}
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url) exec("createLink", url);
            }}
          />
          <ToolbarButton
            label="Ordered list"
            icon={ListOrdered}
            onClick={() => exec("insertOrderedList")}
          />
          <ToolbarButton
            label="Unordered list"
            icon={List}
            onClick={() => exec("insertUnorderedList")}
          />
          <ToolbarButton
            label="Clear formatting"
            icon={RemoveFormatting}
            onClick={() => exec("removeFormat")}
          />
        </div>

        {/* Body */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          tabIndex={0}
          className="min-h-[88px] w-full whitespace-pre-wrap px-4 py-2 text-[14px] text-gray-800 outline-none"
        />

        {/* Attachments — auto quote PDF + user files in one row */}
        <div className="px-4 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* System-managed quote PDF: removable, then re-addable from /api/quote-pdf */}
            {quoteAttached ? (
              <span className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                {attachmentName}
                <button
                  type="button"
                  onClick={() => setQuoteAttached(false)}
                  aria-label="Remove quote attachment"
                  className="ml-1 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setQuoteAttached(true)}
                className="inline-flex items-center gap-1.5 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-[#2563EB] hover:bg-blue-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Re-attach quote
              </button>
            )}
            {/* User-attached files */}
            {userAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
              >
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                {a.name}
                <span className="text-gray-400">({fmtMb(a.size)})</span>
                <button
                  type="button"
                  onClick={() => removeUserAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="ml-1 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          {attachError && <p className="mt-1.5 text-xs text-red-500">{attachError}</p>}
        </div>

        {/* Hidden file picker, opened by the Attach button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesPicked}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => console.log("TODO: discard reply")}
            aria-label="Discard"
            className="rounded p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[13px] text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="flex items-center gap-1.5 rounded-md bg-[#2563EB] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            <Send className="h-3.5 w-3.5" />
            Send Quote
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ChipRow({
  label,
  emails,
  onRemove,
  onAdd,
  trailing,
}: {
  label: string;
  emails: string[];
  onRemove: (email: string) => void;
  onAdd: (email: string) => void;
  trailing?: React.ReactNode;
}) {
  const [input, setInput] = React.useState("");

  function commit() {
    const value = input.trim();
    if (value.includes("@")) {
      onAdd(value);
      setInput("");
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
      <span className="w-8 shrink-0 text-[13px] text-gray-400">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {emails.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[13px] text-gray-700"
          >
            {email}
            <button
              type="button"
              onClick={() => onRemove(email)}
              aria-label={`Remove ${email}`}
              className="ml-0.5 text-gray-400 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder="Add to email"
          className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none placeholder-gray-400"
        />
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
