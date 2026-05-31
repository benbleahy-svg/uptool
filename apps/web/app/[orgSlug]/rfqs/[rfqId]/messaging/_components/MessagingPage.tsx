"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  MoreHorizontal,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  ListOrdered,
  Minus,
  Trash2,
  Send,
  ChevronDown,
  X,
} from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  sizeBytes: number | null;
}

interface Message {
  id: string;
  direction: string;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[] | null;
  subject: string | null;
  bodyText: string | null;
  receivedAt: Date;
  attachments: Attachment[];
}

interface DeclineDraft {
  to: string[];
  subject: string;
  body: string;
}

interface Props {
  subject: string | null;
  contactEmail: string | null;
  messages: Message[];
  orgSlug: string;
  rfqLabel: number;
  // When set (arrived via ?draft=decline), the composer is pre-filled and a
  // confirm-to-send prompt is shown. null = normal messaging view.
  declineDraft?: DeclineDraft | null;
}


function MessageBubble({ message, className }: { message: Message; className?: string }) {
  const isInbound = message.direction === "inbound";
  const body = message.bodyText ?? "";
  const timestamp = format(message.receivedAt, "h:mma, MMM d");

  const recipients = message.toEmails ?? [];
  const primaryRecipient = recipients[0] ?? "—";
  const extraCount = recipients.length - 1;

  return (
    <div className={`flex flex-col ${isInbound ? "items-start" : "items-end"} ${className ?? ""}`}>
      {/* Header — above the bubble */}
      <div className="flex items-center gap-2 mb-1.5 w-[83%]">
        <span className="text-[12px] text-[#6B7280] bg-[#F3F4F6] rounded px-2 py-1 shrink-0">
          {timestamp}
        </span>
        {isInbound ? (
          <>
            <span className="text-[12px] text-[#9CA3AF] shrink-0">from:</span>
            <span className="text-[12px] font-medium text-[#1F2937] shrink-0">
              {message.fromName ?? message.fromEmail ?? "—"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[12px] text-[#9CA3AF] shrink-0">to:</span>
            <span className="text-[12px] font-medium text-[#1F2937] shrink-0">
              {primaryRecipient}
              {extraCount > 0 && (
                <span className="text-[#9CA3AF]"> +{extraCount} more</span>
              )}
            </span>
          </>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => console.log("TODO: message options", message.id)}
          className="text-[#9CA3AF] hover:text-[#1F2937] transition-colors shrink-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-[83%] rounded-lg p-4"
        style={
          isInbound
            ? { background: "#EFF6FF", border: "1px solid #BFDBFE" }
            : { background: "#DBEAFE" }
        }
      >
        {/* Body */}
        <p
          className="text-[14px] text-[#1F2937] leading-relaxed whitespace-pre-wrap"
        >
          {body}
        </p>

        {/* Attachment chips */}
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => console.log("TODO: open attachment", a.filename)}
                className="flex items-center gap-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded px-2 py-1 text-[13px] text-[#374151] transition-colors"
              >
                <Paperclip className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                {a.filename}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessagingPage({
  subject,
  contactEmail,
  messages,
  orgSlug,
  rfqLabel,
  declineDraft = null,
}: Props) {
  const displaySubject = subject
    ? subject.startsWith("Re:") ? subject : `Re: ${subject}`
    : "Re: (no subject)";

  // Composer state. Seeded from the decline draft when present; otherwise the
  // normal empty/derived defaults. All three fields stay editable so a cancelled
  // decline draft can be revised by hand.
  const [to, setTo] = useState<string[]>(
    declineDraft?.to ?? (contactEmail ? [contactEmail] : []),
  );
  const [toInput, setToInput] = useState("");
  const [composeSubject, setComposeSubject] = useState(declineDraft?.subject ?? displaySubject);
  const [body, setBody] = useState(declineDraft?.body ?? "");

  // Confirm-to-send prompt. Auto-opens once when arriving with a decline draft.
  const [confirmOpen, setConfirmOpen] = useState(Boolean(declineDraft));
  const [sent, setSent] = useState(false);
  const autoOpened = useRef(false);
  useEffect(() => {
    if (declineDraft && !autoOpened.current) {
      autoOpened.current = true;
      setConfirmOpen(true);
    }
  }, [declineDraft]);

  function addRecipient(value: string) {
    const v = value.trim().replace(/,$/, "");
    if (v && !to.includes(v)) setTo((prev) => [...prev, v]);
    setToInput("");
  }

  // Stubbed send. Real delivery isn't wired yet — assemble the exact payload the
  // send path will need and log it. No customer email is actually delivered.
  function confirmSend() {
    const payload = {
      rfq: rfqLabel,
      orgSlug,
      to,
      cc: [] as string[],
      bcc: [] as string[],
      subject: composeSubject,
      bodyText: body,
    };
    console.log("[decline notice] (stubbed send — not delivered)", payload);
    setConfirmOpen(false);
    setSent(true);
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(210_20%_96%)]">
      {/* Region 1 — Subject header bar */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2">
        <div className="flex items-center bg-white border border-[#E5E7EB] shadow-sm rounded-full px-4 py-2">
          <span className="text-[14px] font-medium text-[#1F2937]">{displaySubject}</span>
        </div>
        <button
          type="button"
          onClick={() => console.log("TODO: new thread")}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#F3F4F6] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 text-[#6B7280]" />
        </button>
      </div>

      {/* Region 2 — Conversation history */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        <div className="h-full bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-center text-[14px] text-[#9CA3AF] py-8">No messages yet.</p>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const sameDirection = prev && prev.direction === msg.direction;
              const marginClass = i === 0 ? "mt-0" : sameDirection ? "mt-2" : "mt-4";
              return <MessageBubble key={msg.id} message={msg} className={marginClass} />;
            })
          )}
        </div>
      </div>

      {/* Region 3 — Compose area */}
      <div className="shrink-0 px-4 pb-4 pt-0">
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {/* Row 1: To */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F3F4F6] flex-wrap">
          <span className="text-[13px] text-[#9CA3AF] shrink-0 w-14">To:</span>
          {to.map((email) => (
            <span
              key={email}
              className="flex items-center gap-1 bg-[#F3F4F6] rounded px-2 py-0.5 text-[13px] text-[#374151]"
            >
              {email}
              <button
                type="button"
                onClick={() => setTo((prev) => prev.filter((e) => e !== email))}
                className="text-[#9CA3AF] ml-1 hover:text-[#EF4444]"
                aria-label={`Remove ${email}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addRecipient(toInput);
              }
            }}
            onBlur={() => toInput && addRecipient(toInput)}
            placeholder="Add to email"
            className="flex-1 min-w-[120px] text-[13px] outline-none bg-transparent text-[#1F2937]"
          />
        </div>

        {/* Row 2: Subject */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F3F4F6]">
          <span className="text-[13px] text-[#9CA3AF] shrink-0 w-14">Subject:</span>
          <input
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            className="flex-1 text-[13px] text-[#1F2937] outline-none bg-transparent"
          />
        </div>

        {/* Row 3: Toolbar + body */}
        <div className="px-4 pt-2">
          <div className="flex items-center gap-1 pb-2">
            <button
              type="button"
              disabled
              className="flex items-center gap-1 text-[13px] text-[#6B7280] px-2 py-1 rounded hover:bg-[#F3F4F6] cursor-not-allowed opacity-50"
            >
              Normal <ChevronDown className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-[#E5E7EB] mx-1" />
            {[
              { Icon: Bold, label: "Bold" },
              { Icon: Italic, label: "Italic" },
              { Icon: Underline, label: "Underline" },
              { Icon: Link2, label: "Link" },
              { Icon: ListOrdered, label: "Ordered list" },
              { Icon: List, label: "Unordered list" },
              { Icon: Minus, label: "Clear formatting" },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                disabled
                title={label}
                className="p-1.5 rounded text-[#6B7280] hover:bg-[#F3F4F6] cursor-not-allowed opacity-50"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter email text"
            className="w-full h-[120px] text-[14px] text-[#1F2937] placeholder-[#9CA3AF] outline-none bg-transparent resize-none"
          />
        </div>

        {/* Row 4: Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#F3F4F6]">
          {sent && (
            <span className="mr-auto text-[13px] text-green-600">
              Decline notice sent (stubbed — not delivered)
            </span>
          )}
          <button
            type="button"
            onClick={() => console.log("TODO: discard")}
            className="p-2 text-[#6B7280] hover:text-[#EF4444] transition-colors rounded hover:bg-[#FEF2F2]"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => console.log("TODO: attach")}
            className="text-[13px] px-3 py-1.5 border border-[#E5E7EB] rounded-md text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          >
            Attach
          </button>
          <button
            type="button"
            onClick={() =>
              declineDraft
                ? setConfirmOpen(true)
                : console.log("TODO: send")
            }
            className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-md transition-colors font-medium"
          >
            <Send className="w-3.5 h-3.5" />
            Send Email
          </button>
        </div>
      </div>
      </div>

      {/* Confirm-to-send prompt for the decline notice. No email leaves without
          this explicit confirmation. Cancel leaves the draft editable above. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-[15px] font-semibold text-[#1F2937]">Send decline notice?</h2>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="text-[#9CA3AF] hover:text-[#1F2937]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[13px] text-[#6B7280]">
              This sends the decline reply to{" "}
              <span className="font-medium text-[#374151]">{to.join(", ") || "—"}</span>. You can
              review or edit the draft first.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-[#E5E7EB] px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSend}
                disabled={to.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-[#2563EB] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
