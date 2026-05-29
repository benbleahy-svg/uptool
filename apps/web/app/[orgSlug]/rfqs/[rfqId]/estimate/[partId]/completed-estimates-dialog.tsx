"use client";

import {
  Button,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  cn,
} from "@uptool/ui";
import { ArrowDown, Box, ExternalLink, Search, X } from "lucide-react";
import * as React from "react";
import { COMPLETED_ESTIMATES } from "./mocks/mockPart";

export function CompletedEstimatesDialog() {
  const [query, setQuery] = React.useState("");
  const [sortDesc, setSortDesc] = React.useState(true);

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return COMPLETED_ESTIMATES.filter((e) =>
      `${e.partNumber} ${e.company} ${e.contact}`.toLowerCase().includes(needle),
    ).sort((a, b) =>
      sortDesc ? b.lastUpdatedAt - a.lastUpdatedAt : a.lastUpdatedAt - b.lastUpdatedAt,
    );
  }, [query, sortDesc]);

  return (
    <DialogContent className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 pr-8">
        <DialogTitle>Completed Estimates</DialogTitle>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by part / company / contact…"
            className="h-9 pl-8 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <DialogDescription className="sr-only">
        Search and import a prior completed estimate.
      </DialogDescription>

      <div className="-mx-1 max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
              <th className="px-3 py-2 font-medium">Part Number</th>
              <th className="px-3 py-2 font-medium">Part Revision</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => setSortDesc((s) => !s)}
                  className="inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))]"
                >
                  Last Updated
                  <ArrowDown
                    className={cn("h-3 w-3 transition-transform", !sortDesc && "rotate-180")}
                  />
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Quantities</th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-[hsl(var(--muted)/0.5)]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                      <Box className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{e.partNumber}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                  {e.partRevision || "—"}
                </td>
                <td className="px-3 py-2">{e.company}</td>
                <td className="px-3 py-2">{e.contact}</td>
                <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{e.lastUpdated}</td>
                <td className="px-3 py-2 tabular-nums">{e.quantities.join(", ")}</td>
                <td className="px-3 py-2">
                  <DialogClose asChild>
                    <Button size="sm">Import</Button>
                  </DialogClose>
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 whitespace-nowrap"
                    onClick={() => console.log("Open in new tab", e.id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in New Tab
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]"
                >
                  No matching estimates
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DialogContent>
  );
}
