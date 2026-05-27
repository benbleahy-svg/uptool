"use client";

import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export interface CustomerRow {
  id: string;
  name: string;
  domain: string | null;
  contactCount: number;
  openRfqCount: number;
  lastRfqAt: string | null;
}

interface Props {
  data: CustomerRow[];
  orgSlug: string;
  labels: {
    company: string;
    domain: string;
    contacts: string;
    openRfqs: string;
    lastRfq: string;
    emptyTitle: string;
  };
}

const col = createColumnHelper<CustomerRow>();

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (!direction) return <span className="ml-1 opacity-30">↕</span>;
  return <span className="ml-1">{direction === "asc" ? "↑" : "↓"}</span>;
}

export function CustomerTable({ data, orgSlug, labels }: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    col.accessor("name", {
      header: labels.company,
      cell: (i) => <span className="font-medium">{i.getValue()}</span>,
    }),
    col.accessor("domain", {
      header: labels.domain,
      cell: (i) => i.getValue() ?? "—",
    }),
    col.accessor("contactCount", {
      header: labels.contacts,
      cell: (i) => i.getValue(),
    }),
    col.accessor("openRfqCount", {
      header: labels.openRfqs,
      cell: (i) => i.getValue(),
    }),
    col.accessor("lastRfqAt", {
      header: labels.lastRfq,
      cell: (i) => {
        const v = i.getValue();
        if (!v) return "—";
        return new Date(v).toLocaleDateString("de-DE");
      },
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{labels.emptyTitle}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[hsl(var(--muted)/0.5)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider cursor-pointer select-none hover:text-[hsl(var(--foreground))]"
                  onClick={h.column.getToggleSortingHandler()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      h.column.getToggleSortingHandler()?.(e);
                    }
                  }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  <SortIcon direction={h.column.getIsSorted()} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-[hsl(var(--border))]">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-[hsl(var(--muted)/0.3)] cursor-pointer transition-colors"
              onClick={() => router.push(`/${orgSlug}/customers/${row.original.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  router.push(`/${orgSlug}/customers/${row.original.id}`);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
