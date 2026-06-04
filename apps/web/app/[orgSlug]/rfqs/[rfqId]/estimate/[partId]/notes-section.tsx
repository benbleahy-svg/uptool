"use client";

import { Plus, X } from "lucide-react";
import * as React from "react";

type NoteField = "external" | "internal";

interface Props {
  external: string;
  internal: string;
  /** Persist a note field (debounced by the parent). Empty string clears it. */
  onChange: (field: NoteField, value: string) => void;
}

export function NotesSection({ external, internal, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 px-5 py-4">
      <NoteField
        label="External Notes (Prints on Quote)"
        value={external}
        onChange={(v) => onChange("external", v)}
      />
      <NoteField
        label="Internal Notes (Prints on Traveler)"
        value={internal}
        onChange={(v) => onChange("internal", v)}
      />
    </div>
  );
}

function NoteField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Open when there's a saved value, or once the user opens it this session.
  const [open, setOpen] = React.useState(value.trim() !== "");

  if (!open) {
    return (
      <div className="min-w-[18rem] flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5 text-gray-400" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[18rem] flex-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Plus className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </button>
      <div className="relative mt-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          rows={3}
          aria-label={label}
          className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        <button
          type="button"
          onClick={() => {
            onChange(""); // clear (persists empty string)
            setOpen(false);
          }}
          aria-label={`Clear ${label}`}
          className="absolute right-2 top-2 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
