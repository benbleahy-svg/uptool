"use client";

import { useState } from "react";
import { PaperclipIcon } from "lucide-react";

type Category = "all" | "drawings" | "cad" | "bom" | "other";

const DRAWINGS_EXT = new Set([".pdf", ".dwg", ".dxf", ".drw"]);
const CAD_EXT = new Set([".step", ".stp", ".iges", ".igs", ".stl", ".3mf", ".x_t", ".x_b", ".sldprt", ".sldasm"]);
const BOM_EXT = new Set([".xlsx", ".xls", ".csv"]);

function getCategory(filename: string): Category {
  const ext = `.${filename.split(".").pop()?.toLowerCase() ?? ""}`;
  if (DRAWINGS_EXT.has(ext)) return "drawings";
  if (CAD_EXT.has(ext)) return "cad";
  if (BOM_EXT.has(ext)) return "bom";
  return "other";
}

interface Attachment {
  id: string;
  filename: string;
  url: string;
}

interface Props {
  attachments: Attachment[];
  labels: {
    all: string;
    drawings: string;
    cad: string;
    bom: string;
    other: string;
    none: string;
  };
}

export function AttachmentPanel({ attachments, labels }: Props) {
  const [active, setActive] = useState<Category>("all");

  const counts: Record<Category, number> = {
    all: attachments.length,
    drawings: attachments.filter((a) => getCategory(a.filename) === "drawings").length,
    cad: attachments.filter((a) => getCategory(a.filename) === "cad").length,
    bom: attachments.filter((a) => getCategory(a.filename) === "bom").length,
    other: attachments.filter((a) => getCategory(a.filename) === "other").length,
  };

  const tabs: { key: Category; label: string }[] = [
    { key: "all", label: labels.all },
    { key: "drawings", label: labels.drawings },
    { key: "cad", label: labels.cad },
    { key: "bom", label: labels.bom },
    { key: "other", label: labels.other },
  ];

  const visible = active === "all"
    ? attachments
    : attachments.filter((a) => getCategory(a.filename) === active);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              active === tab.key
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.8)]"
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="ml-1 opacity-70">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* File list */}
      {visible.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{labels.none}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[hsl(var(--primary))] hover:underline"
              >
                <PaperclipIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{a.filename}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
