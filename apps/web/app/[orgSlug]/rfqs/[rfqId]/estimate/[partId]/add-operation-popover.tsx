"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@uptool/ui";
import { CircleDollarSign, Clock, type LucideIcon, Search, SprayCan, Zap } from "lucide-react";
import * as React from "react";

// NOTE: "Laser Cutting" and "Finishing (new)" are intentionally omitted — their
// rich type-specific field bags (cut speed, finishing process, …) have no DB
// column in the time-based persisted model, so they can't be saved yet. They
// return with the fields-jsonb epic (see ADR 0020). Every other entry resolves
// to a generic time-based op (setup/run), which persists cleanly.
const RECENTLY_USED = ["Pack and Ship", "Inspection", "Deburr", "CNC Milling", "Programming"];

const ALL_OPS = [
  "Programming",
  "Screw machine #1",
  "xxxx",
  "CNC Turning",
  "Tapping Machine #2",
  "Deburr",
  "Inspection",
  "Manufacture Fixture",
  "Pack and Ship",
  "Polishing",
  "Marking / Engraving",
  "formula",
  "Heat Treat",
  // "Laser Cutting" + "Finishing (new)" omitted — see RECENTLY_USED note (ADR 0020).
  "Waterjet Cutting",
  "Hardware Operation",
  "EDM (wire)",
  "Grinding",
  "EDM (sinker)",
  "Casting",
  "CNC Milling v2",
  "CNC 5 AXIS HAAS",
  "Laser Programming",
  "€50 packaging cost",
];

function iconFor(name: string): LucideIcon {
  if (/\$|cost|heat treat/i.test(name)) return CircleDollarSign;
  if (/laser|waterjet/i.test(name)) return Zap;
  if (/finishing/i.test(name)) return SprayCan;
  return Clock;
}

interface Props {
  trigger: React.ReactNode;
  onAdd: (name: string) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function AddOperationPopover({ trigger, onAdd, side = "bottom", align = "start" }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const match = (name: string) => name.toLowerCase().includes(needle);
  const recent = RECENTLY_USED.filter(match);
  const all = ALL_OPS.filter(match);

  function select(name: string) {
    onAdd(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 p-0">
        <div className="border-b border-gray-200 p-3">
          <div className="mb-2 text-sm font-semibold text-gray-900">Select operation to add</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to Search"
              aria-label="Search operations"
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-2 text-sm outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {recent.length > 0 && (
            <>
              <SectionLabel>Recently Used</SectionLabel>
              {recent.map((name) => (
                <OpMenuRow key={`recent-${name}`} name={name} onSelect={() => select(name)} />
              ))}
            </>
          )}
          {all.length > 0 && (
            <>
              <SectionLabel>All</SectionLabel>
              {all.map((name) => (
                <OpMenuRow key={`all-${name}`} name={name} onSelect={() => select(name)} />
              ))}
            </>
          )}
          {recent.length === 0 && all.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-400">No matching operations</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </div>
  );
}

function OpMenuRow({ name, onSelect }: { name: string; onSelect: () => void }) {
  const Icon = iconFor(name);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
    >
      <Icon className="h-4 w-4 flex-none text-gray-500" />
      <span>{name}</span>
    </button>
  );
}
