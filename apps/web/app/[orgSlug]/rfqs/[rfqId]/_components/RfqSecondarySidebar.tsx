"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Inbox, Network, Pencil, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useSidebarCollapse } from "@/components/sidebar-collapse-context";

interface Part {
  id: string;
  partNumber: string | null;
  description: string | null;
  sortOrder: number;
}

interface Props {
  orgSlug: string;
  rfqNumber: number;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  parts: Part[];
}

export function RfqSecondarySidebar({
  orgSlug,
  rfqNumber,
  companyName,
  contactName,
  contactEmail,
  parts,
}: Props) {
  const { collapsed, setCollapsed } = useSidebarCollapse();
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const pathname = usePathname();
  const isMessaging = pathname.endsWith("/messaging");

  // Reset both sidebars to expanded when leaving the RFQ detail page
  useEffect(() => {
    return () => setCollapsed(false);
  }, [setCollapsed]);

  const steps = [
    { key: "estimate", label: "Estimate", parts },
    { key: "quote", label: "Quote", parts: [] as Part[] },
    { key: "send", label: "Send", parts: [] as Part[] },
  ];

  return (
    <div
      className="relative shrink-0 min-w-0"
      style={{
        width: collapsed ? "44px" : "280px",
        transition: "width 200ms ease-in-out",
      }}
    >
      <aside className="h-full w-full border-r border-[hsl(var(--border))] bg-[hsl(210_16%_91%)] overflow-hidden">
        <div className={`flex flex-col mx-4 h-full transition-opacity duration-150 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          {/* RFQ pill */}
          <div className="pt-4 pb-3">
            <Link
              href={`/${orgSlug}/rfqs/${rfqNumber}`}
              className="flex items-center gap-2 bg-blue-50 rounded-md border border-blue-200 px-3 py-2 hover:bg-blue-100 transition-colors"
            >
              <List className="w-4 h-4 text-[#1F2937] shrink-0" />
              <span className="text-sm font-medium text-[#1F2937]">RFQ {rfqNumber}</span>
            </Link>
          </div>

          {/* Company name */}
          <p className="text-base font-semibold pb-3">{companyName ?? "—"}</p>

          {/* FIX 2: Contact card — grey background matching sidebar, equal px-3
              padding, shadow-sm, full wrapper width (248px). */}
          <div className="pb-3">
            <div className="flex items-start justify-between bg-[hsl(210_16%_91%)] rounded-md border border-[#E5E7EB] px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold leading-snug">{contactName ?? "—"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-snug mt-0.5">
                  {contactEmail ?? "—"}
                </p>
              </div>
              <button
                type="button"
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mt-0.5 ml-2 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* FIX 3: Revision + Create New RFQ — both h-8 (32px), text-[13px],
              gap-2, items-center. */}
          <div className="pb-3 flex items-center gap-2">
            <select className="h-8 text-[13px] border border-[hsl(var(--border))] rounded-md px-2 bg-white text-[hsl(var(--foreground))]">
              <option>Revision 1</option>
            </select>
            <button
              type="button"
              className="h-8 flex-1 text-[13px] border border-[hsl(var(--border))] rounded-md px-3 bg-white hover:bg-[hsl(var(--accent))] whitespace-nowrap text-[hsl(var(--foreground))]"
            >
              Create New RFQ
            </button>
          </div>

          {/* Messaging */}
          <div className="pb-1">
            <Link
              href={`/${orgSlug}/rfqs/${rfqNumber}/messaging`}
              className={`flex items-center gap-2 w-full py-2 px-2 text-sm rounded-md transition-colors ${isMessaging ? "bg-[#F3F4F6] text-[#1F2937] font-medium" : "text-[hsl(var(--foreground))] hover:bg-[hsl(0_0%_93%)]"}`}
            >
              <Inbox className={`w-4 h-4 ${isMessaging ? "text-[#1F2937]" : "text-[hsl(var(--muted-foreground))]"}`} />
              Messaging
            </Link>
          </div>

          {/* Timeline */}
          <div className="pb-3">
            <button
              type="button"
              className="flex items-center gap-2 w-full py-2 px-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(0_0%_93%)] rounded-md"
            >
              <Network className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              Timeline
            </button>
          </div>

          {/* FIX 1: Workflow stepper
              - Two-column layout: left col = circle + connector, right col = label + children
              - Circle: w-5 h-5 (20px) for both active and inactive
              - Active fill: #2563EB (blue-600), no border
              - Inactive: white interior, 2px border #D1D5DB
              - Connector: 2px wide, #D1D5DB, grows to span the full height of each row
              - Labels: font-medium (500) for all; active = #1F2937, inactive = #9CA3AF
          */}
          <div className="pb-4">
            {steps.map((step, i) => {
              const isActive = i === 0;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.key} className="flex gap-3">
                  {/* Left col: circle + connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-5 h-5 rounded-full shrink-0 ${
                        isActive
                          ? "bg-[#2563EB]"
                          : "bg-white border-2 border-[#D1D5DB]"
                      }`}
                    />
                    {!isLast && (
                      <div className="w-[2px] flex-1 min-h-[16px] bg-[#D1D5DB] mt-1" />
                    )}
                  </div>

                  {/* Right col: label + optional parts list */}
                  <div className={`min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                    <p
                      className={`text-sm font-medium leading-5 ${
                        isActive ? "text-[#1F2937]" : "text-[#9CA3AF]"
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.parts.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {step.parts.map((part) => (
                          <button
                            key={part.id}
                            type="button"
                            onClick={() => setSelectedPartId(part.id)}
                            className={`w-full text-left text-xs px-2 py-1 rounded ${
                              selectedPartId === part.id
                                ? "bg-blue-100 text-[#2563EB] font-medium"
                                : "text-[#1F2937] hover:bg-[hsl(0_0%_93%)]"
                            }`}
                          >
                            {part.partNumber ?? part.description ?? "—"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Download all files */}
          <div className="mt-auto pt-4 pb-4">
            <button
              type="button"
              onClick={() => console.log("TODO: download all files for RFQ", rfqNumber)}
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(210_16%_91%)] hover:bg-[hsl(0_0%_93%)] transition-colors text-[13px] font-medium text-[#1F2937]"
            >
              <Download className="w-4 h-4 shrink-0" />
              Download Files
            </button>
          </div>
        </div>
      </aside>

      {/* Chevron — outside the overflow-hidden aside, not clipped */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={`absolute top-[40%] -translate-y-1/2 z-20 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-[hsl(214_32%_91%)] shadow-sm ${collapsed ? "left-1/2 -translate-x-1/2" : "-right-[12px]"}`}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        )}
      </button>
    </div>
  );
}
