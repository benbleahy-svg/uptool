"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Box,
  Table2,
  File,
  LayoutGrid,
  List,
  Search,
  Upload,
  ChevronRight,
  Mail,
  Inbox,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Category = "drawing" | "cad" | "bom" | "other";

interface Attachment {
  id: string;
  filename: string;
  sizeBytes: number | null;
  category: string;
  createdAt: Date;
}

interface Part {
  id: string;
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  material: string | null;
  processType: string | null;
  sortOrder: number;
}

interface EmailMsg {
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  bodyText: string | null;
  receivedAt: Date;
}

interface Props {
  rfqNumber: number;
  quantityBreaks: number[];
  lastEmail: EmailMsg | null;
  attachments: Attachment[];
  parts: Part[];
  orgSlug: string;
  rfqId: string;
}

const PROCESS: Record<string, { label: string; className: string }> = {
  cnc_milling: { label: "CNC Milling", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  sheet_metal: { label: "Sheet Metal", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  cnc_turning: { label: "CNC Turning", className: "bg-violet-50 text-violet-700 border border-violet-200" },
  laser_cutting: { label: "Laser Cutting", className: "bg-red-50 text-red-700 border border-red-200" },
};

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const CAT: Record<Category, { label: string; plural: string; short: string; Icon: IconComponent; color: string }> = {
  drawing: { label: "Drawing", plural: "Drawings", short: "Draw", Icon: FileText, color: "#6366F1" },
  cad: { label: "CAD", plural: "CAD", short: "CAD", Icon: Box, color: "#10B981" },
  bom: { label: "BOM", plural: "BOM", short: "BOM", Icon: Table2, color: "#F59E0B" },
  other: { label: "Other", plural: "Other", short: "Other", Icon: File, color: "#6B7280" },
};


export function RfqOverview({ rfqNumber: _rfqNumber, quantityBreaks, lastEmail, attachments, parts, orgSlug, rfqId }: Props) {
  const router = useRouter();
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(["drawing", "cad", "bom", "other"]),
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filtered = attachments.filter(
    (a) =>
      activeCategories.has(a.category) &&
      a.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-4">

        {/* Top row: Last email + Files side by side */}
        <div className="flex gap-3 mb-3 h-[288px]">

          {/* Last email */}
          <section className="flex-1 min-w-0 flex flex-col bg-white rounded-lg border border-[#E5E7EB]">
            <div className="flex-1 overflow-auto p-4">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3">
                <Mail className="shrink-0 text-[#1F2937]" style={{ width: 18, height: 18 }} />
                <span className="text-[14px] font-semibold text-[#1F2937]">Last Email</span>
                <div className="ml-3 flex items-center gap-1 min-w-0">
                  <span className="text-[13px] text-[#9CA3AF] shrink-0">from:</span>
                  <span className="text-[13px] text-[#6B7280] truncate">
                    {lastEmail
                      ? `${lastEmail.fromName ?? lastEmail.fromEmail ?? "—"}, ${formatDistanceToNow(lastEmail.receivedAt, { addSuffix: true })}`
                      : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!lastEmail}
                  onClick={() => console.log("TODO: open email thread")}
                  className="ml-auto shrink-0 flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium bg-white border border-[#E5E7EB] rounded hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Inbox style={{ width: 14, height: 14 }} />
                  Open
                </button>
              </div>

              {lastEmail ? (
                <>
                  {/* Subject row */}
                  <p className="text-[13px] pt-1 pb-2">
                    <span className="text-[#9CA3AF]">Subject: </span>
                    <span className="text-[#1F2937]">{lastEmail.subject ?? "—"}</span>
                  </p>
                  {/* Divider */}
                  <hr className="border-[#E5E7EB]" />
                  {/* Body */}
                  {lastEmail.bodyText && (
                    <div className="pt-3">
                      <p className="text-[13px] text-[#1F2937] leading-[1.5] whitespace-pre-line">
                        {lastEmail.bodyText}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="pt-3">
                  <p className="text-[13px] text-[#9CA3AF]">No emails yet</p>
                </div>
              )}
            </div>
          </section>

          {/* Files */}
          <section className="flex-1 min-w-0 flex flex-col bg-white rounded-lg border border-[hsl(var(--border))]">
            {/* Header — single row; checkboxes fill middle and clip when panel is narrow */}
            <div className="shrink-0 px-4 py-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
              {/* Title */}
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="w-4 h-4 text-[#1F2937]" />
                <span className="text-[14px] font-semibold text-[#1F2937] whitespace-nowrap">{attachments.length} Files</span>
              </div>
              {/* Category checkboxes — flex-1 so they fill remaining space; overflow-hidden clips if panel is narrow */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                {(["drawing", "cad", "bom", "other"] as Category[]).map((cat) => {
                  const count = attachments.filter((a) => a.category === cat).length;
                  return (
                    <label key={cat} className="flex items-center gap-1 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={activeCategories.has(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="w-3 h-3 rounded accent-[hsl(var(--primary))]"
                      />
                      <span className="text-[11px] font-bold text-[#374151] whitespace-nowrap">
                        {CAT[cat].short}{" "}
                        <span className="font-bold text-[#1F2937]">({count})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {/* Upload */}
              <button
                type="button"
                className="flex items-center gap-1 shrink-0 h-6 px-2 text-[11px] font-bold border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--accent))] transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
              {/* Grid / List toggle */}
              <div className="flex items-center border border-[hsl(var(--border))] rounded p-0.5 gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1 rounded ${viewMode === "grid" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1 rounded ${viewMode === "list" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Search */}
              <div className="flex items-center gap-1 w-[120px] h-6 px-2 border border-[hsl(var(--border))] rounded-md shrink-0">
                <Search className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-[11px] focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {filtered.length === 0 ? (
                <p className="text-sm text-center py-4 text-[hsl(var(--muted-foreground))]">
                  No files match.
                </p>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-5 gap-2">
                  {filtered.map((a) => {
                    const cfg = CAT[a.category as Category] ?? CAT.other;
                    const Icon = cfg.Icon;
                    const ext = a.filename.split(".").pop()?.toUpperCase() ?? "FILE";
                    return (
                      <div
                        key={a.id}
                        className="flex flex-col border border-[hsl(var(--border))] rounded-lg overflow-hidden hover:border-[hsl(var(--primary))] cursor-default"
                      >
                        {/* Placeholder area */}
                        <div className="h-[120px] bg-[#F3F4F6] flex flex-col items-center justify-center gap-2 shrink-0">
                          <Icon style={{ width: 48, height: 48, color: cfg.color }} />
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}
                          >
                            {ext}
                          </span>
                        </div>
                        {/* Info area */}
                        <div className="px-2 py-1.5 flex flex-col gap-0.5">
                          <p className="text-[11px] font-bold truncate">{a.filename}</p>
                          <p className="text-[10px] text-[#9CA3AF]">
                            {format(a.createdAt, "h:mma, MMM d")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((a) => {
                    const cfg = CAT[a.category as Category] ?? CAT.other;
                    const Icon = cfg.Icon;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 py-2 px-3 border border-[hsl(var(--border))] rounded-lg hover:border-[hsl(var(--primary))] cursor-default"
                      >
                        <Icon style={{ width: 20, height: 20, color: cfg.color }} className="shrink-0" />
                        <p className="text-xs font-bold truncate flex-1">{a.filename}</p>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 capitalize">
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                          {format(a.createdAt, "h:mma, MMM d")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Parts — full width */}
        <section className="bg-white rounded-lg border border-[hsl(var(--border))]">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Parts{" "}
              <span className="font-normal text-[hsl(var(--muted-foreground))]">({parts.length})</span>
            </h2>
            <div className="flex items-center gap-1">
              {quantityBreaks.map((q) => (
                <span
                  key={q}
                  className="text-[11px] px-2 py-0.5 bg-[hsl(var(--accent))] rounded text-[hsl(var(--muted-foreground))]"
                >
                  {q}×
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {parts.length === 0 ? (
              <p className="text-sm text-center py-6 text-[hsl(var(--muted-foreground))]">
                No parts added yet.
              </p>
            ) : (
              parts.map((part) => {
                const proc = part.processType ? (PROCESS[part.processType] ?? null) : null;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => router.push(`/${orgSlug}/rfqs/${rfqId}?part=${part.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="w-10 h-10 shrink-0 rounded border border-[hsl(var(--border))] bg-[hsl(210_20%_96%)] flex items-center justify-center">
                      <Box className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {part.partNumber ?? "—"}
                          {part.revision && (
                            <span className="font-normal text-[hsl(var(--muted-foreground))] ml-1 text-xs">
                              {part.revision}
                            </span>
                          )}
                        </p>
                        {proc && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${proc.className}`}
                          >
                            {proc.label}
                          </span>
                        )}
                      </div>
                      {part.description && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                          {part.description}
                        </p>
                      )}
                      {part.material && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                          {part.material}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </section>

      </div>{/* end scrollable */}

      {/* Action bar */}
      <div className="shrink-0 border-t border-[hsl(var(--border))] bg-white px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          className="text-sm px-4 py-2 border border-[hsl(var(--border))] rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
        >
          No Bid RFQ
        </button>
        <button
          type="button"
          className="text-sm px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md hover:opacity-90 transition-opacity font-medium"
        >
          Create Quote →
        </button>
      </div>
    </div>
  );
}
