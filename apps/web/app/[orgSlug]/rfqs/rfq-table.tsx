"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { InboxIcon, Search, Info, Plus, MoreVertical, Box } from "lucide-react";
import { updateRfqStatus } from "./actions";
import { AssigneeCell } from "./assignee-cell";
import type { OrgMember } from "@uptool/services";

export type RfqRow = {
  id: string;
  rfqNumber: number;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  subject: string | null;
  status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid";
  receivedAt: string;
  lastEmailAt: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  partCount: number;
};

// ─── Org logo ─────────────────────────────────────────────────────────────────

function OrgLogo({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-9 w-9 rounded-md object-contain shrink-0"
      />
    );
  }
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0 select-none">
      <span className="text-sm font-semibold text-[hsl(var(--primary-foreground))]">
        {initial}
      </span>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const PILL_FILL: Record<RfqRow["status"], number | "won" | "closed"> = {
  new: 0,
  estimated: 1,
  quoted: 2,
  sent: 3,
  won: "won",
  lost: "closed",
  no_bid: "closed",
};

function StatusPill({ status, label }: { status: RfqRow["status"]; label: string }) {
  const fill = PILL_FILL[status];

  if (fill === "closed") {
    return (
      <div className="flex flex-col items-center">
        <span className="inline-flex items-center rounded-full border border-[hsl(214_32%_91%)] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
      </div>
    );
  }

  const filledCount = fill === "won" ? 3 : (fill as number);
  const fillColor = fill === "won" ? "bg-green-500" : "bg-[hsl(215_81%_38%)]";
  const emptyColor = "bg-[hsl(214_32%_91%)]";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-3 w-6 ${i === 0 ? "rounded-l-full" : ""} ${i === 2 ? "rounded-r-full" : ""} ${i < filledCount ? fillColor : emptyColor}`}
          />
        ))}
      </div>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none">{label}</span>
    </div>
  );
}

// ─── Parts cell ───────────────────────────────────────────────────────────────

function PartThumb() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(0_0%_96%)]">
      <Box className="h-3.5 w-3.5 text-[hsl(215_16%_47%)]" />
    </div>
  );
}

function PartsCell({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium bg-[hsl(0_0%_96%)] min-w-[20px] ${count === 0 ? "text-[hsl(var(--muted-foreground))]" : "text-[hsl(var(--foreground))]"}`}
      >
        {count}
      </span>
      {count > 0 && <PartThumb />}
      {count > 1 && <PartThumb />}
      {count > 2 && <PartThumb />}
    </div>
  );
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatSmartDate(
  isoStr: string,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  const date = new Date(isoStr);
  const now = new Date();
  const isDE = locale === "de";

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = isDE
    ? date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

  if (sameDay(date, now)) {
    return `${labels.today}, ${timeStr}`;
  }
  if (sameDay(date, yesterday)) {
    return `${labels.yesterday}, ${timeStr}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    const dayMonth = isDE
      ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.`
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${dayMonth}, ${timeStr}`;
  }
  return isDE
    ? date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatRelative(
  isoStr: string,
  labels: { today: string; ago: string; agoPlural: string },
): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.ago.replace("{n}", "1");
  return labels.agoPlural.replace("{n}", String(diffDays));
}

// ─── Kebab menu ───────────────────────────────────────────────────────────────

function KebabMenu({
  rfqId,
  orgSlug,
  labels,
}: {
  rfqId: string;
  orgSlug: string;
  labels: { noBid: string; archive: string; delete: string; comingSoon: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function handleNoBid() {
    setOpen(false);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("rfqId", rfqId);
    fd.set("status", "no_bid");
    startTransition(() => updateRfqStatus(fd));
  }

  return (
    <div
      ref={ref}
      className="relative flex justify-end"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(0_0%_96%)] hover:text-[hsl(var(--foreground))] transition-colors"
        aria-label="Row actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-md border border-[hsl(var(--border))] bg-white shadow-lg py-1">
          <button
            type="button"
            onClick={handleNoBid}
            className="flex w-full items-center px-3 py-2 text-sm hover:bg-[hsl(0_0%_96%)] transition-colors"
          >
            {labels.noBid}
          </button>
          <div className="my-1 border-t border-[hsl(var(--border))]" />
          <button
            type="button"
            disabled
            title={labels.comingSoon}
            className="flex w-full items-center px-3 py-2 text-sm opacity-40 cursor-not-allowed"
          >
            {labels.archive}
          </button>
          <button
            type="button"
            disabled
            title={labels.comingSoon}
            className="flex w-full items-center px-3 py-2 text-sm text-red-500 opacity-40 cursor-not-allowed"
          >
            {labels.delete}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

const TH =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] cursor-pointer select-none whitespace-nowrap";
const TH_CENTER =
  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] cursor-pointer select-none whitespace-nowrap";

const columnHelper = createColumnHelper<RfqRow>();

interface Props {
  data: RfqRow[];
  orgSlug: string;
  orgName: string;
  orgLogoUrl: string | null;
  members: OrgMember[];
  locale: string;
  forwardingAddress: string | null;
  onCreateRfq: (fd: FormData) => Promise<void>;
  labels: {
    title: string;
    searchPlaceholder: string;
    forwardingAddress: string;
    forwardingLabel: string;
    forwardingCopyConfirm: string;
    forwardingTooltip: string;
    newRfq: string;
    number: string;
    company: string;
    contact: string;
    parts: string;
    status: string;
    dateReceived: string;
    lastEmail: string;
    assignee: string;
    assignPlaceholder: string;
    assignSearch: string;
    assignUnassigned: string;
    assignEmpty: string;
    kebabNoBid: string;
    kebabArchive: string;
    kebabDelete: string;
    kebabComingSoon: string;
    dateToday: string;
    dateYesterday: string;
    dateAgo: string;
    dateAgoPlural: string;
    emptyTitle: string;
    emptySubtitle: string;
    noFilterResults: string;
    newRfqSubject: string;
    newRfqSubjectPlaceholder: string;
    newRfqCustomerEmail: string;
    newRfqCustomerName: string;
    newRfqCreate: string;
  };
  statusLabels: Record<RfqRow["status"], string>;
}

export function RfqTable({
  data,
  orgSlug,
  orgName,
  orgLogoUrl,
  members,
  locale,
  forwardingAddress,
  onCreateRfq,
  labels,
  statusLabels,
}: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [newRfqOpen, setNewRfqOpen] = useState(false);
  const [formPending, startFormTransition] = useTransition();

  const dateLabels = {
    today: labels.dateToday,
    yesterday: labels.dateYesterday,
    ago: labels.dateAgo,
    agoPlural: labels.dateAgoPlural,
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(
      (row) =>
        row.companyName.toLowerCase().includes(q) ||
        (row.contactName ?? "").toLowerCase().includes(q) ||
        (row.contactEmail ?? "").toLowerCase().includes(q) ||
        (row.subject ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  function handleCopy() {
    if (!forwardingAddress) return;
    navigator.clipboard.writeText(forwardingAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreateRfq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("orgSlug", orgSlug);
    startFormTransition(() =>
      onCreateRfq(fd).then(() => {
        setNewRfqOpen(false);
        (e.target as HTMLFormElement).reset();
      }),
    );
  }

  const columns = [
    columnHelper.accessor("rfqNumber", {
      header: labels.number,
      cell: (info) => (
        <span className="text-sm font-medium">#{info.getValue()}</span>
      ),
      size: 80,
    }),
    columnHelper.accessor("companyName", {
      header: labels.company,
      cell: (info) => (
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
          {info.getValue()}
        </span>
      ),
      size: 180,
    }),
    columnHelper.display({
      id: "contact",
      header: labels.contact,
      cell: (info) => {
        const { contactName, contactEmail } = info.row.original;
        const display = contactName ?? contactEmail;
        return (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {display ?? "—"}
          </span>
        );
      },
      size: 160,
    }),
    columnHelper.accessor("partCount", {
      header: labels.parts,
      cell: (info) => <PartsCell count={info.getValue()} />,
      size: 640,
    }),
    columnHelper.accessor("status", {
      header: labels.status,
      cell: (info) => (
        <StatusPill status={info.getValue()} label={statusLabels[info.getValue()]} />
      ),
      size: 150,
    }),
    columnHelper.accessor("receivedAt", {
      header: labels.dateReceived,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
          {formatSmartDate(info.getValue(), locale, dateLabels)}
        </span>
      ),
      size: 100,
    }),
    columnHelper.accessor("lastEmailAt", {
      header: labels.lastEmail,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
          {info.getValue()
            ? formatRelative(info.getValue() as string, dateLabels)
            : "—"}
        </span>
      ),
      size: 100,
    }),
    columnHelper.display({
      id: "assignee",
      header: labels.assignee,
      cell: (info) => (
        <AssigneeCell
          rfqId={info.row.original.id}
          orgSlug={orgSlug}
          assigneeId={info.row.original.assigneeId}
          assigneeInitial={
            info.row.original.assigneeName
              ? (info.row.original.assigneeName[0]?.toUpperCase() ?? null)
              : null
          }
          members={members}
          labels={{
            placeholder: labels.assignPlaceholder,
            search: labels.assignSearch,
            unassigned: labels.assignUnassigned,
            empty: labels.assignEmpty,
          }}
        />
      ),
      size: 150,
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <KebabMenu
          rfqId={info.row.original.id}
          orgSlug={orgSlug}
          labels={{
            noBid: labels.kebabNoBid,
            archive: labels.kebabArchive,
            delete: labels.kebabDelete,
            comingSoon: labels.kebabComingSoon,
          }}
        />
      ),
      size: 40,
    }),
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col h-full bg-[hsl(210_20%_95%)]">
      {/* Top bar — sits on grey, outside the white card */}
      <div className="flex h-16 items-center gap-4 px-6 flex-shrink-0">
        <OrgLogo name={orgName} url={orgLogoUrl} />
        <h1 className="text-xl font-semibold shrink-0">{labels.title}</h1>

        <div className="relative max-w-[600px] w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div className="flex-1" />

        {forwardingAddress && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
              {labels.forwardingLabel}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-[hsl(var(--primary))] font-mono hover:underline truncate max-w-[200px]"
              title={forwardingAddress}
            >
              {copied ? labels.forwardingCopyConfirm : forwardingAddress}
            </button>
            <span title={labels.forwardingTooltip} className="cursor-help">
              <Info className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            </span>
          </div>
        )}

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setNewRfqOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {labels.newRfq}
          </button>

          {newRfqOpen && (
            <>
              <button
                type="button"
                aria-label="Close"
                className="fixed inset-0 z-10"
                onClick={() => setNewRfqOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-80 rounded-md border border-[hsl(var(--border))] bg-white shadow-md p-4">
                <form onSubmit={handleCreateRfq} className="space-y-3">
                  <div>
                    <label
                      htmlFor="new-rfq-subject"
                      className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
                    >
                      {labels.newRfqSubject}
                    </label>
                    <input
                      id="new-rfq-subject"
                      name="subject"
                      className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      placeholder={labels.newRfqSubjectPlaceholder}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-rfq-email"
                      className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
                    >
                      {labels.newRfqCustomerEmail}
                    </label>
                    <input
                      id="new-rfq-email"
                      name="fromEmail"
                      type="email"
                      className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-rfq-name"
                      className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
                    >
                      {labels.newRfqCustomerName}
                    </label>
                    <input
                      id="new-rfq-name"
                      name="fromName"
                      className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formPending}
                    className="w-full rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {labels.newRfqCreate}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table — white card */}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-t-lg border border-[hsl(var(--border))] shadow-sm overflow-hidden mx-4">
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <InboxIcon className="w-12 h-12 text-[hsl(var(--muted-foreground))] mb-4" />
            <h2 className="text-lg font-semibold mb-2">{labels.emptyTitle}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
              {labels.emptySubtitle}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(0_0%_99%)] sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={header.column.id === "status" ? TH_CENTER : TH}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          header.column.getToggleSortingHandler()?.(e);
                      }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && " ↑"}
                        {header.column.getIsSorted() === "desc" && " ↓"}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]"
                  >
                    {labels.noFilterResults}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[hsl(215_81%_96%)] cursor-pointer transition-colors"
                    style={{ height: "60px" }}
                    onClick={() => router.push(`/${orgSlug}/rfqs/${row.original.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        router.push(`/${orgSlug}/rfqs/${row.original.id}`);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
}
