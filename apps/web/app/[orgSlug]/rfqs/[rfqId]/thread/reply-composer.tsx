"use client";

import { useRef, useState, useTransition } from "react";
import { sendReply } from "./actions";

interface Props {
  orgSlug: string;
  rfqId: string;
  defaultTo: string;
  defaultSubject: string;
  labels: {
    reply: string;
    replyTo: string;
    replySubject: string;
    replyBody: string;
    sendReply: string;
  };
}

export function ReplyComposer({ orgSlug, rfqId, defaultTo, defaultSubject, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await sendReply(formData);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  return (
    <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
        >
          ↩ {labels.reply}
        </button>
      ) : (
        <form ref={formRef} action={handleSubmit} className="space-y-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="rfqId" value={rfqId} />

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="reply-to" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                {labels.replyTo}
              </label>
              <input
                id="reply-to"
                name="toEmail"
                type="email"
                required
                defaultValue={defaultTo}
                className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="reply-subject" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                {labels.replySubject}
              </label>
              <input
                id="reply-subject"
                name="subject"
                type="text"
                required
                defaultValue={defaultSubject}
                className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reply-body" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.replyBody}
            </label>
            <textarea
              id="reply-body"
              name="bodyText"
              rows={5}
              required
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : labels.sendReply}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
