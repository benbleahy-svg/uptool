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
  Plus,
  Info,
  X,
  Pencil,
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
  partId: string | null;
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

const PROCESS_LABEL: Record<string, string> = {
  cnc_milling: "CNC MILLING",
  sheet_metal: "SHEET METAL",
  cnc_turning: "CNC TURNING",
  additive: "ADDITIVE",
  laser_cutting: "LASER CUTTING",
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
  const [showHint, setShowHint] = useState(true);
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">

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
              {/* Upload */}
              <button
                type="button"
                className="flex items-center gap-1 shrink-0 h-6 px-2 text-[11px] font-normal border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--accent))] transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
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

        {/* Parts — full width
            Grid columns: [row#] [pill] [thumb] [id 2fr] [qty 90px] [files 1fr]
            Both the header and every data row use the same template so columns
            are pixel-perfect without any placeholder hacks. */}
        <section className="bg-white rounded-lg border border-[hsl(var(--border))]">
          {/* Header */}
          <div className="grid items-center px-4 py-3 border-b border-[hsl(var(--border))] gap-x-3 grid-cols-[20px_104px_72px_2fr_180px_1fr]">
            {/* cols 1-4 merged: title + add button */}
            <div className="col-span-4 flex items-center gap-2">
              <h2 className="text-[14px] font-semibold text-[#1F2937]">Parts</h2>
              <button
                type="button"
                onClick={() => console.log("TODO: add part")}
                className="flex items-center justify-center w-7 h-7 rounded border border-[hsl(var(--border))] bg-white hover:bg-[#F3F4F6] transition-colors shadow-sm"
              >
                <Plus style={{ width: 14, height: 14 }} className="text-[#6B7280]" />
              </button>
            </div>
            {/* col 5: Quantities label */}
            <span className="text-right text-[13px] font-bold text-[#6B7280]">Quantities</span>
            {/* col 6: Files label + hint pill + EDIT — all in the rightmost column so EDIT sits at the far right */}
            <div className="flex items-center gap-2 pl-2">
              <span className="text-[13px] font-bold text-[#6B7280]">Files</span>
              <div className="flex-1" />
              {showHint && (
                <div className="flex items-center gap-2 bg-[#1F2937] text-white px-3 py-1.5 rounded text-[13px] shrink-0">
                  <Info style={{ width: 14, height: 14 }} />
                  <span>Click to edit parts</span>
                  <button
                    type="button"
                    onClick={() => setShowHint(false)}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => console.log("TODO: enter edit mode")}
                className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-1.5 rounded text-[13px] font-medium transition-colors shrink-0"
              >
                <Pencil style={{ width: 14, height: 14 }} />
                EDIT
              </button>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[hsl(var(--border))]">
            {parts.length === 0 ? (
              <p className="text-sm text-center py-6 text-[hsl(var(--muted-foreground))]">
                No parts added yet.
              </p>
            ) : (
              parts.map((part, index) => {
                const processLabel = part.processType ? (PROCESS_LABEL[part.processType] ?? null) : null;
                const partFiles = attachments.filter((a) => a.partId === part.id);
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => router.push(`/${orgSlug}/rfqs/${rfqId}?part=${part.id}`)}
                    className="w-full grid items-start px-4 py-3 text-left hover:bg-[hsl(var(--accent))] transition-colors gap-x-3 grid-cols-[20px_104px_72px_2fr_180px_1fr]"
                  >
                    {/* col 1: row number */}
                    <span className="text-right text-[13px] text-[#9CA3AF] pt-[5px]">{index + 1}</span>

                    {/* col 2: process pill */}
                    <div>
                      {processLabel && (
                        <span className="inline-block bg-[#1F2937] text-white text-[11px] font-semibold uppercase tracking-[0.05em] px-2.5 py-1 rounded-md">
                          {processLabel}
                        </span>
                      )}
                    </div>

                    {/* col 3: thumbnail placeholder */}
                    <div className="w-[72px] h-[72px] rounded border border-[hsl(var(--border))] bg-[hsl(210_20%_96%)] flex items-center justify-center">
                      <Box className="w-9 h-9 text-[hsl(var(--muted-foreground))]" />
                    </div>

                    {/* col 4: identification block */}
                    <div className="min-w-0 overflow-hidden pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-semibold text-[#1F2937]">
                          {part.partNumber ?? "—"}
                        </span>
                        {part.revision && (
                          <span className="text-[13px] text-[#6B7280]">Rev {part.revision}</span>
                        )}
                      </div>
                      {part.description && (
                        <p className="text-[13px] text-[#9CA3AF] truncate mt-2">
                          {part.description}
                        </p>
                      )}
                    </div>

                    {/* col 5: quantities */}
                    <div className="text-right text-[13px] text-[#1F2937]">
                      {quantityBreaks.join(",")}
                    </div>

                    {/* col 6: files linked to this part */}
                    <div className="pl-2 flex flex-col gap-1 min-w-0 overflow-hidden">
                      {partFiles.map((f) => {
                        const cfg = CAT[f.category as Category] ?? CAT.other;
                        const Icon = cfg.Icon;
                        return (
                          <div key={f.id} className="flex items-center gap-1.5 min-w-0">
                            <Icon style={{ width: 13, height: 13, color: cfg.color, flexShrink: 0 }} />
                            <span className="text-[12px] text-[#374151] truncate">{f.filename}</span>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

      </div>{/* end scrollable */}

      {/* Action bar */}
      <div className="shrink-0 border-t border-[hsl(var(--border))] bg-white px-4 py-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="text-sm px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-colors font-medium"
        >
          No Bid RFQ
        </button>
        <button
          type="button"
          disabled
          className="text-sm px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md font-medium opacity-50 cursor-not-allowed"
        >
          Create Quote
        </button>
      </div>
    </div>
  );
}
