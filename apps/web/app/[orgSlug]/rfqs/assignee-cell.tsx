"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "@uptool/ui";
import type { OrgMember } from "@uptool/services";
import { assignRfq } from "./actions";

interface Props {
  rfqId: string;
  orgSlug: string;
  assigneeId: string | null;
  assigneeInitial: string | null;
  members: OrgMember[];
  labels: {
    placeholder: string;
    search: string;
    unassigned: string;
    empty: string;
  };
}

export function AssigneeCell({
  rfqId,
  orgSlug,
  assigneeId,
  assigneeInitial,
  members,
  labels,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [optimisticId, setOptimisticId] = useState<string | null | undefined>(undefined);
  const [focusIndex, setFocusIndex] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentId = optimisticId !== undefined ? optimisticId : assigneeId;
  const currentMember = currentId ? members.find((m) => m.userId === currentId) : null;
  const displayName =
    currentMember?.name ?? (currentMember ? currentMember.email.split("@")[0] : null);
  const displayInitial = currentMember?.avatarInitial ?? (currentId ? assigneeInitial : null);

  const filtered = members.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const showUnassigned = !!currentId;
  type Option = { userId: string | null; name: string | null; email: string; avatarInitial: string };
  const options: Option[] = [
    ...(showUnassigned
      ? [{ userId: null, name: labels.unassigned, email: "", avatarInitial: "—" }]
      : []),
    ...filtered,
  ];

  function openDropdown(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(true);
    setQuery("");
    setFocusIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(userId: string | null) {
    setOpen(false);
    setOptimisticId(userId);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("rfqId", rfqId);
    if (userId) fd.set("assigneeUserId", userId);
    startTransition(() => assignRfq(fd));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[focusIndex];
      if (opt) select(opt.userId);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={openDropdown}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-full border px-2.5 py-1 cursor-pointer transition-colors",
          "border-[hsl(214_32%_91%)] bg-white hover:border-[hsl(214_32%_80%)]",
        )}
      >
        {displayName ? (
          <>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-medium text-white">
              {displayInitial}
            </span>
            <span className="truncate text-sm">{displayName}</span>
          </>
        ) : (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">{labels.placeholder}</span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 min-w-[240px] w-max max-w-xs rounded-md border border-[hsl(var(--border))] bg-white shadow-lg"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusIndex(0);
              }}
              placeholder={labels.search}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {labels.empty}
              </div>
            ) : (
              options.map((opt, i) => {
                const isUnassigned = opt.userId === null;
                const isSelected = opt.userId === currentId;
                const label = opt.name ?? opt.email.split("@")[0];
                return (
                  <button
                    key={opt.userId ?? "__unassigned__"}
                    type="button"
                    onClick={() => select(opt.userId)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      i === focusIndex
                        ? "bg-[hsl(0_0%_96%)]"
                        : "hover:bg-[hsl(0_0%_96%)]",
                    )}
                  >
                    {isUnassigned ? (
                      <X className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-medium text-white">
                        {opt.avatarInitial}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "truncate",
                          isUnassigned && "text-[hsl(var(--muted-foreground))]",
                        )}
                      >
                        {label}
                      </div>
                      {!isUnassigned && opt.email && (
                        <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                          {opt.email}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
