"use client";

import { Plus, X } from "lucide-react";
import * as React from "react";

interface NoteState {
  shown: boolean;
  value: string;
}

export function NotesSection() {
  const [external, setExternal] = React.useState<NoteState>({ shown: false, value: "" });
  const [internal, setInternal] = React.useState<NoteState>({ shown: false, value: "" });

  return (
    <div className="flex flex-wrap gap-2 px-5 py-4">
      <NoteField
        label="External Notes (Prints on Quote)"
        state={external}
        onOpen={() => setExternal((s) => ({ ...s, shown: true }))}
        onChange={(value) => setExternal((s) => ({ ...s, value }))}
        onClear={() => setExternal({ shown: false, value: "" })}
      />
      <NoteField
        label="Internal Notes (Prints on Traveler)"
        state={internal}
        onOpen={() => setInternal((s) => ({ ...s, shown: true }))}
        onChange={(value) => setInternal((s) => ({ ...s, value }))}
        onClear={() => setInternal({ shown: false, value: "" })}
      />
    </div>
  );
}

function NoteField({
  label,
  state,
  onOpen,
  onChange,
  onClear,
}: {
  label: string;
  state: NoteState;
  onOpen: () => void;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="min-w-[18rem] flex-1">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Plus className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </button>

      {state.shown && (
        <div className="relative mt-2">
          <textarea
            value={state.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            rows={3}
            aria-label={label}
            className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="absolute right-2 top-2 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
