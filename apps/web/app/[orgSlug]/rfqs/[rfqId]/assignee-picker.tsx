"use client";

import { useTransition } from "react";
import { updateAssignee } from "./actions";

interface Member {
  userId: string;
  name: string | null;
  email: string;
}

interface Props {
  orgSlug: string;
  rfqId: string;
  currentAssigneeId: string | null;
  members: Member[];
}

export function AssigneePicker({ orgSlug, rfqId, currentAssigneeId, members }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("rfqId", rfqId);
    fd.set("assigneeId", value);
    startTransition(() => updateAssignee(fd));
  }

  return (
    <select
      value={currentAssigneeId ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] text-[hsl(var(--foreground))]"
    >
      <option value="">— Unassigned</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name ?? m.email}
        </option>
      ))}
    </select>
  );
}
