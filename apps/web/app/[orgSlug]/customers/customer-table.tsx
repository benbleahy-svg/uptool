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
import { useMemo, useState, useTransition } from "react";
import { Search, Plus, Download, MoreVertical, AlertTriangle } from "lucide-react";

export interface CustomerRow {
  id: string;
  name: string;
  domain: string | null;
  contactCount: number;
  contactEmails: string[];
  rfqCount: number;
  lastRfqAt: string | null;
}

interface Labels {
  title: string;
  company: string;
  emailDomain: string;
  contacts: string;
  rfqs: string;
  lastRfq: string;
  emptyTitle: string;
  noFilterResults: string;
  searchPlaceholder: string;
  exportContacts: string;
  addCompany: string;
  addCompanyName: string;
  addCompanyNamePlaceholder: string;
  addCompanyDomain: string;
  addCompanyDomainPlaceholder: string;
  addCompanyCreate: string;
  flaggedTooltip: string;
  actionView: string;
  actionDelete: string;
}

interface Props {
  data: CustomerRow[];
  orgSlug: string;
  orgName: string;
  orgLogoUrl: string | null;
  locale: string;
  onCreateCompany: (formData: FormData) => Promise<void>;
  labels: Labels;
}

// Free/consumer email providers — a company on one of these (rather than a
// corporate domain) is flagged for review. Includes common DACH providers.
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.de",
  "hotmail.com",
  "hotmail.de",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "freenet.de",
]);

function isFlagged(domain: string | null): boolean {
  return !!domain && GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

// Locale-aware relative time: "25 minutes ago" / "vor 2 Monaten".
function formatRelativeTime(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    numeric: "always",
  });
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const month = Math.round(day / 30);
  const year = Math.round(month / 12);
  if (Math.abs(sec) < 60) return rtf.format(-sec, "second");
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  if (Math.abs(hr) < 24) return rtf.format(-hr, "hour");
  if (Math.abs(day) < 30) return rtf.format(-day, "day");
  if (Math.abs(month) < 12) return rtf.format(-month, "month");
  return rtf.format(-year, "year");
}

function OrgLogo({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-9 w-9 rounded-md object-contain shrink-0" />;
  }
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0 select-none">
      <span className="text-sm font-semibold text-[hsl(var(--primary-foreground))]">{initial}</span>
    </div>
  );
}

function ContactsCell({ count, emails }: { count: number; emails: string[] }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="inline-flex items-center justify-center rounded-full bg-[hsl(0_0%_96%)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foreground))] min-w-[22px] shrink-0">
        {count}
      </span>
      <span className="truncate text-sm text-[hsl(var(--foreground))]">
        {emails.length > 0 ? emails.join(", ") : "—"}
      </span>
    </div>
  );
}

function ActionsMenu({
  onView,
  labels,
}: {
  onView: () => void;
  labels: Pick<Labels, "actionView" | "actionDelete">;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Actions"
        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.5)]"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-[hsl(var(--border))] bg-white py-1 shadow-md">
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[hsl(var(--muted)/0.5)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onView();
              }}
            >
              {labels.actionView}
            </button>
            {/* Delete is stubbed until a destructive-delete flow exists. */}
            <button
              type="button"
              disabled
              className="block w-full px-3 py-1.5 text-left text-sm text-[hsl(var(--muted-foreground))] opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              {labels.actionDelete}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const col = createColumnHelper<CustomerRow>();

export function CustomerTable({
  data,
  orgSlug,
  orgName,
  orgLogoUrl,
  locale,
  onCreateCompany,
  labels,
}: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.domain ?? "").toLowerCase().includes(q) ||
        c.contactEmails.some((e) => e.toLowerCase().includes(q)),
    );
  }, [data, search]);

  function handleExport() {
    const header = ["Company", "Email Domain", "Contact Email"];
    const lines = [header.join(",")];
    for (const c of data) {
      const escapedName = `"${c.name.replace(/"/g, '""')}"`;
      if (c.contactEmails.length === 0) {
        lines.push([escapedName, c.domain ?? "", ""].join(","));
      } else {
        for (const email of c.contactEmails) {
          lines.push([escapedName, c.domain ?? "", email].join(","));
        }
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleAddCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("orgSlug", orgSlug);
    startTransition(() =>
      onCreateCompany(fd).then(() => {
        setAddOpen(false);
        form.reset();
      }),
    );
  }

  const columns = [
    col.accessor("name", {
      header: labels.company,
      cell: (i) => (
        <span className="flex items-center gap-1.5">
          {isFlagged(i.row.original.domain) && (
            <span title={labels.flaggedTooltip} className="shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
          <span className="font-medium text-[hsl(var(--foreground))]">{i.getValue()}</span>
        </span>
      ),
    }),
    col.accessor("domain", {
      header: labels.emailDomain,
      enableSorting: false,
      cell: (i) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{i.getValue() ?? "—"}</span>
      ),
    }),
    col.accessor("contactCount", {
      header: labels.contacts,
      enableSorting: false,
      cell: (i) => <ContactsCell count={i.getValue()} emails={i.row.original.contactEmails} />,
    }),
    col.accessor("rfqCount", {
      header: labels.rfqs,
      enableSorting: false,
      cell: (i) => <span className="text-sm text-[hsl(var(--foreground))]">{i.getValue()}</span>,
    }),
    col.accessor("lastRfqAt", {
      header: labels.lastRfq,
      enableSorting: false,
      cell: (i) => {
        const v = i.getValue();
        return (
          <span className="text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
            {v ? formatRelativeTime(v, locale) : "—"}
          </span>
        );
      },
    }),
    col.display({
      id: "actions",
      header: () => null,
      cell: (i) => (
        <ActionsMenu
          onView={() => router.push(`/${orgSlug}/customers/${i.row.original.id}`)}
          labels={{ actionView: labels.actionView, actionDelete: labels.actionDelete }}
        />
      ),
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
      {/* Top bar — logo + title + search + actions, sits on grey above the card */}
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

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-white px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted)/0.5)] transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          {labels.exportContacts}
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {labels.addCompany}
          </button>

          {addOpen && (
            <>
              <button
                type="button"
                aria-label="Close"
                className="fixed inset-0 z-10"
                onClick={() => setAddOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-80 rounded-md border border-[hsl(var(--border))] bg-white shadow-md p-4">
                <form onSubmit={handleAddCompany} className="space-y-3">
                  <div>
                    <label
                      htmlFor="add-company-name"
                      className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
                    >
                      {labels.addCompanyName}
                    </label>
                    <input
                      id="add-company-name"
                      name="name"
                      required
                      className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      placeholder={labels.addCompanyNamePlaceholder}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-company-domain"
                      className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
                    >
                      {labels.addCompanyDomain}
                    </label>
                    <input
                      id="add-company-domain"
                      name="domain"
                      className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      placeholder={labels.addCompanyDomainPlaceholder}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {labels.addCompanyCreate}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table — white bordered card */}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-t-lg border border-[hsl(var(--border))] shadow-sm overflow-hidden mx-4">
        <div className="flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{labels.emptyTitle}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[hsl(210_20%_98%)] border-b border-[hsl(var(--border))] sticky top-0">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const canSort = h.column.getCanSort();
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          className={`px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider select-none ${
                            canSort ? "cursor-pointer hover:text-[hsl(var(--foreground))]" : ""
                          }`}
                          onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                          onKeyDown={
                            canSort
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ")
                                    h.column.getToggleSortingHandler()?.(e);
                                }
                              : undefined
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {canSort && (
                              <span className={sorted ? "" : "opacity-30"}>
                                {sorted === "desc" ? "↓" : "↑"}
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-[hsl(214_32%_94%)]">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]"
                    >
                      {labels.noFilterResults}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[hsl(210_20%_98%)] cursor-pointer transition-colors"
                      onClick={() => router.push(`/${orgSlug}/customers/${row.original.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          router.push(`/${orgSlug}/customers/${row.original.id}`);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-4">
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
