"use client";

import { useTransition } from "react";
import { disconnectEmailAccount } from "./actions";

interface Props {
  accountId: string;
  orgSlug: string;
  label: string;
  confirmText: string;
}

export function DisconnectButton({ accountId, orgSlug, label, confirmText }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(confirmText)) return;
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("orgSlug", orgSlug);
    startTransition(() => disconnectEmailAccount(fd));
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
    >
      {label}
    </button>
  );
}
