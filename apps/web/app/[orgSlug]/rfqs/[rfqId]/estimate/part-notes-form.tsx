"use client";

import { useRef } from "react";
import { updatePartNotes } from "./actions";

interface Props {
  orgSlug: string;
  rfqId: string;
  partId: string;
  notesExternal: string | null;
  notesInternal: string | null;
  labels: {
    notesExternal: string;
    notesExternalHint: string;
    notesInternal: string;
    notesInternalHint: string;
  };
}

export function PartNotesForm({
  orgSlug,
  rfqId,
  partId,
  notesExternal,
  notesInternal,
  labels,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleBlur() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={updatePartNotes} className="mt-3 grid grid-cols-2 gap-3 border-t border-[hsl(var(--border))] pt-3">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="partId" value={partId} />
      <div>
        <label
          htmlFor={`${partId}-notes-ext`}
          className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
        >
          {labels.notesExternal}{" "}
          <span className="text-[10px] italic">({labels.notesExternalHint})</span>
        </label>
        <textarea
          id={`${partId}-notes-ext`}
          name="notesExternal"
          rows={2}
          defaultValue={notesExternal ?? ""}
          onBlur={handleBlur}
          className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
        />
      </div>
      <div>
        <label
          htmlFor={`${partId}-notes-int`}
          className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
        >
          {labels.notesInternal}{" "}
          <span className="text-[10px] italic">({labels.notesInternalHint})</span>
        </label>
        <textarea
          id={`${partId}-notes-int`}
          name="notesInternal"
          rows={2}
          defaultValue={notesInternal ?? ""}
          onBlur={handleBlur}
          className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
        />
      </div>
    </form>
  );
}
