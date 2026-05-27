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
import { useState, useTransition, useMemo } from "react";
import { InboxIcon, Ban, ArrowRight } from "lucide-react";
import { updateRfqStatus, bulkUpdateRfqStatus } from "./actions";

export type RfqRow = {
  id: string;
  rfqNumber: number;
  customerName: string;
  subject: string | null;
  status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid";
  receivedAt: string;
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
  const router = useRouter();
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
  const emptyColor = "bg-gray-200";

  function handleNoBid(e: React.MouseEvent) {
    e.stopPropagation();
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("rfqId", rfqId);
    fd.set("status", "no_bid");
    startTransition(() => updateRfqStatus(fd));
  }

  function handleSend(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/${orgSlug}/rfqs/${rfqId}/send`);
  }

  return (
    <div className="flex items-center gap-2 group/status">
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i < filledCount ? pillColor : emptyColor}`}
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
          <button
            type="button"
            title="Go to Send"
            onClick={handleSend}
            className="rounded p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const columnHelper = createColumnHelper<RfqRow>();

interface Props {
  data: RfqRow[];
  orgSlug: string;
  currentUserId: string;
  labels: {
    number: string;
    customer: string;
    subject: string;
    status: string;
    received: string;
    assignee: string;
    emptyTitle: string;
    emptySubtitle: string;
    searchPlaceholder: string;
    filterAllStatuses: string;
    filterMine: string;
    noFilterResults: string;
    bulkNoBid: string;
    bulkSelected: string;
  };
  statusLabels: Record<RfqRow["status"], string>;
}

const STATUS_VALUES: RfqRow["status"][] = [
  "new", "estimated", "quoted", "sent", "won", "lost", "no_bid",
];

export function RfqTable({ data, orgSlug, currentUserId, labels, statusLabels }: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((row) => {
      if (q && !row.customerName.toLowerCase().includes(q) && !(row.subject ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter && row.status !== statusFilter) return false;
      if (mineOnly && row.assigneeId !== currentUserId) return false;
      return true;
    });
  }, [data, search, statusFilter, mineOnly, currentUserId]);

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
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
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
      size: 70,
    }),
    columnHelper.accessor("customerName", {
      header: labels.customer,
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor("subject", {
      header: labels.subject,
      cell: (info) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[hsl(var(--muted-foreground))] truncate max-w-xs block">
            {info.getValue() ?? "—"}
          </span>
          {info.row.original.attachmentCount > 0 && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] font-medium">
              📎 {info.row.original.attachmentCount}
            </span>
          )}
        </div>
      ),
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
      header: labels.received,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {new Date(info.getValue()).toLocaleDateString()}
        </span>
      ),
      size: 120,
    }),
    columnHelper.accessor("assigneeName", {
      header: labels.assignee,
      cell: (info) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {info.getValue() ?? "—"}
        </span>
      ),
      size: 120,
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
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="search"
          placeholder={labels.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-[hsl(var(--border))] px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">{labels.filterAllStatuses}</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          {labels.filterMine}
        </label>
        {(search || statusFilter || mineOnly) && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {filtered.length} / {data.length}
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[hsl(var(--accent))] border border-[hsl(var(--border))]">
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

      {filtered.length === 0 && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <div className="rounded-full bg-[hsl(var(--muted))] p-4 mb-4">
            <InboxIcon className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h2 className="text-lg font-semibold mb-2">{labels.emptyTitle}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
            {labels.emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] cursor-pointer select-none whitespace-nowrap"
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
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    {labels.noFilterResults}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[hsl(var(--muted)/0.3)] cursor-pointer transition-colors"
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
        </div>
      )}
    </div>
  );
}
