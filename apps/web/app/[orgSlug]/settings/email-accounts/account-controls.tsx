"use client";

import { useTransition } from "react";
import { setDefaultSendAction, setOwnerAction } from "./actions";

interface Member {
  userId: string;
  name: string | null;
  email: string;
}

interface Props {
  orgSlug: string;
  accountId: string;
  ownerUserId: string | null;
  isDefaultSend: boolean;
  members: Member[];
  ownerLabel: string;
  unassignedLabel: string;
  defaultSendLabel: string;
}

export function AccountControls({
  orgSlug,
  accountId,
  ownerUserId,
  isDefaultSend,
  members,
  ownerLabel,
  unassignedLabel,
  defaultSendLabel,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <select
        aria-label={ownerLabel}
        disabled={pending}
        value={ownerUserId ?? ""}
        onChange={(e) =>
          startTransition(() => setOwnerAction(orgSlug, accountId, e.target.value || null))
        }
        className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="">{unassignedLabel}</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
      <button
        type="button"
        title={defaultSendLabel}
        aria-label={defaultSendLabel}
        aria-pressed={isDefaultSend}
        disabled={pending}
        onClick={() => startTransition(() => setDefaultSendAction(orgSlug, accountId))}
        className={`text-lg leading-none disabled:opacity-50 ${
          isDefaultSend ? "text-amber-500" : "text-gray-300 hover:text-amber-400"
        }`}
      >
        {isDefaultSend ? "★" : "☆"}
      </button>
    </div>
  );
}
