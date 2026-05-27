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
import { InboxIcon, Ban, Search, Copy, Check, Info, Plus, MoreVertical } from "lucide-react";
import { updateRfqStatus, bulkUpdateRfqStatus } from "./actions";
import { AssigneeCell } from "./assignee-cell";
import type { OrgMember } from "@uptool/services";

export type RfqRow = {
  id: string;
  rfqNumber: number;
  companyName: string;
  contactEmail: string | null;
  subject: string | null;
  status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid";
  receivedAt: string;
  lastEmailAt: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  attachmentCount: number;
};

const STATUS_SEGMENTS: Record<RfqRow["status"], number | "won" | "closed"> = {
  new: 0,
  estimated: 1,
  quoted: 2,
  sent: 3,
  won: "won",
  lost: "closed",
  no_bid: "closed",
};

function StatusPills({
  status,
  label,
  orgSlug,
  rfqId,
}: {
  status: RfqRow["status"];
  label: string;
  orgSlug: string;
  rfqId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const seg = STATUS_SEGMENTS[status];

  if (seg === "closed") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
        {label}
      </span>
    );
  }

  const filledCount = seg === "won" ? 4 : (seg as number);
  const pillColor = seg === "won" ? "bg-green-500" : "bg-blue-500";

  function handleNoBid(e: React.MouseEvent) {
    e.stopPropagation();
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("rfqId", rfqId);
    fd.set("status", "no_bid");
    startTransition(() => updateRfqStatus(fd));
  }

  return (
    <div className="flex items-center gap-2 group/status">
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i < filledCount ? pillColor : "bg-gray-200"}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      </div>
      {status === "new" && (
        <div className="hidden group-hover/status:flex items-center gap-1">
          <button
            type="button"
            title="No Bid"
            onClick={handleNoBid}
            disabled={isPending}
            className="rounded p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function KebabMenu({
  rfqId,
  orgSlug,
  labels,
}: {
  rfqId: string;
  orgSlug: string;
  labels: {
    noBid: string;
    assign: string;
    archive: string;
    delete: string;
    comingSoon: string;
  };
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
        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(0_0%_96%)] hover:text-[hsl(var(--foreground))] transition-colors"
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

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] cursor-pointer select-none whitespace-nowrap";

const columnHelper = createColumnHelper<RfqRow>();

interface Props {
  data: RfqRow[];
  orgSlug: string;
  members: OrgMember[];
  forwardingAddress: string | null;
  onCreateRfq: (fd: FormData) => Promise<void>;
  labels: {
    title: string;
    searchPlaceholder: string;
    forwardingAddress: string;
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
    emptyTitle: string;
    emptySubtitle: string;
    noFilterResults: string;
    bulkNoBid: string;
    bulkSelected: string;
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
  members,
  forwardingAddress,
  onCreateRfq,
  labels,
  statusLabels,
}: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [newRfqOpen, setNewRfqOpen] = useState(false);
  const [formPending, startFormTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(
      (row) =>
        row.companyName.toLowerCase().includes(q) ||
        (row.contactEmail ?? "").toLowerCase().includes(q) ||
        (row.subject ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const allVisibleIds = filtered.map((r) => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allVisibleIds));
  }

  function handleBulkNoBid() {
    const ids = [...selected];
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("status", "no_bid");
    for (const id of ids) fd.append("rfqIds", id);
    startBulkTransition(() => {
      bulkUpdateRfqStatus(fd).then(() => setSelected(new Set()));
    });
  }

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
    columnHelper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="rounded border-[hsl(var(--border))]"
          aria-label="Select all"
        />
      ),
      cell: (info) => (
        <input
          type="checkbox"
          checked={selected.has(info.row.original.id)}
          onChange={() => toggleRow(info.row.original.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-[hsl(var(--border))]"
          aria-label="Select row"
        />
      ),
      size: 40,
    }),
    columnHelper.accessor("rfqNumber", {
      header: labels.number,
      cell: (info) => <span className="font-mono text-sm">#{info.getValue()}</span>,
      size: 80,
    }),
    columnHelper.accessor("companyName", {
      header: labels.company,
      cell: (info) => <span className="font-medium text-sm">{info.getValue()}</span>,
    }),
    columnHelper.accessor("contactEmail", {
      header: labels.contact,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{info.getValue() ?? "—"}</span>
      ),
    }),
    columnHelper.accessor("attachmentCount", {
      header: labels.parts,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {info.getValue() > 0 ? info.getValue() : "—"}
        </span>
      ),
      size: 60,
    }),
    columnHelper.accessor("status", {
      header: labels.status,
      cell: (info) => (
        <StatusPills
          status={info.getValue()}
          label={statusLabels[info.getValue()]}
          orgSlug={orgSlug}
          rfqId={info.row.original.id}
        />
      ),
      size: 160,
    }),
    columnHelper.accessor("receivedAt", {
      header: labels.dateReceived,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {new Date(info.getValue()).toLocaleDateString()}
        </span>
      ),
      size: 120,
    }),
    columnHelper.accessor("lastEmailAt", {
      header: labels.lastEmail,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : "—"}
        </span>
      ),
      size: 120,
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
              ? info.row.original.assigneeName[0]?.toUpperCase() ?? null
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
      size: 180,
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
            assign: "",
            archive: labels.kebabArchive,
            delete: labels.kebabDelete,
            comingSoon: labels.kebabComingSoon,
          }}
        />
      ),
      size: 48,
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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex h-16 items-center gap-4 px-6 border-b border-[hsl(var(--border))] flex-shrink-0">
        <h1 className="text-2xl font-semibold shrink-0">{labels.title}</h1>

        {/* Search */}
        <div className="relative max-w-[480px] w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        {/* Forwarding address */}
        {forwardingAddress && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{labels.forwardingAddress}:</span>
            <code className="text-xs bg-[hsl(var(--muted))] px-2 py-1 rounded font-mono">{forwardingAddress}</code>
            <button
              type="button"
              onClick={handleCopy}
              title={labels.forwardingCopyConfirm}
              className="p-1 rounded hover:bg-[hsl(var(--accent))] transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              )}
            </button>
            <span
              title={labels.forwardingTooltip}
              className="cursor-help"
            >
              <Info className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* New RFQ button */}
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
                    <label htmlFor="new-rfq-subject" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
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
                    <label htmlFor="new-rfq-email" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
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
                    <label htmlFor="new-rfq-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-[hsl(var(--accent))] border-b border-[hsl(var(--border))] flex-shrink-0">
          <span className="text-sm font-medium">
            {selected.size} {labels.bulkSelected}
          </span>
          <button
            type="button"
            onClick={handleBulkNoBid}
            disabled={bulkPending}
            className="rounded border border-[hsl(var(--border))] bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {labels.bulkNoBid}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <InboxIcon className="w-12 h-12 text-[hsl(var(--muted-foreground))] mb-4" />
            <h2 className="text-lg font-semibold mb-2">{labels.emptyTitle}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">{labels.emptySubtitle}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={TH}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
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
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    {labels.noFilterResults}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[hsl(var(--muted)/0.3)] cursor-pointer transition-colors h-14"
                    onClick={() => router.push(`/${orgSlug}/rfqs/${row.original.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        router.push(`/${orgSlug}/rfqs/${row.original.id}`);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5">
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
  );
}
