"use client";

import { useRef } from "react";
import { updateQuantityBreaks } from "./actions";

interface Props {
  orgSlug: string;
  rfqId: string;
  quantityBreaks: number[];
  label: string;
  hint: string;
}

export function QuantityBreaksEditor({ orgSlug, rfqId, quantityBreaks, label, hint }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateQuantityBreaks} className="flex items-center gap-1.5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="rfqId" value={rfqId} />
      <label htmlFor={`qty-${rfqId}`} className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
        {label}:
      </label>
      <input
        id={`qty-${rfqId}`}
        name="quantities"
        defaultValue={quantityBreaks.join(", ")}
        placeholder={hint}
        onBlur={() => formRef.current?.requestSubmit()}
        className="rounded border border-[hsl(var(--border))] px-2 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
    </form>
  );
}
