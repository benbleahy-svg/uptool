"use client";

import { useState } from "react";
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

interface Props {
  subject: string | null;
  contactEmail: string | null;
  messages: Message[];
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

export function MessagingPage({ subject, contactEmail, messages }: Props) {
  const [body, setBody] = useState("");
  const displaySubject = subject
    ? subject.startsWith("Re:") ? subject : `Re: ${subject}`
    : "Re: (no subject)";

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
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F3F4F6]">
          <span className="text-[13px] text-[#9CA3AF] shrink-0 w-14">To:</span>
          {contactEmail && (
            <span className="flex items-center gap-1 bg-[#F3F4F6] rounded px-2 py-0.5 text-[13px] text-[#374151]">
              {contactEmail}
              <button type="button" className="text-[#9CA3AF] ml-1 cursor-not-allowed" disabled>×</button>
            </span>
          )}
          <input
            disabled
            placeholder="Add to email"
            className="flex-1 text-[13px] outline-none bg-transparent text-[#9CA3AF] cursor-not-allowed"
          />
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => console.log("TODO: add Cc")}
              className="text-[13px] text-[#2563EB] hover:underline"
            >
              +Cc
            </button>
            <button
              type="button"
              onClick={() => console.log("TODO: add Bcc")}
              className="text-[13px] text-[#2563EB] hover:underline"
            >
              +Bcc
            </button>
          </div>
        </div>

        {/* Row 2: Subject */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F3F4F6]">
          <span className="text-[13px] text-[#9CA3AF] shrink-0 w-14">Subject:</span>
          <input
            disabled
            defaultValue={displaySubject}
            className="flex-1 text-[13px] text-[#1F2937] outline-none bg-transparent cursor-not-allowed"
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
            onClick={() => console.log("TODO: send")}
            className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-md transition-colors font-medium"
          >
            <Send className="w-3.5 h-3.5" />
            Send Email
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
