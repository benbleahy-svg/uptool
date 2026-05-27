"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  address: string;
  title: string;
  subtitle: string;
  copyLabel: string;
  copiedLabel: string;
}

export function ForwardingAddressSection({ address, title, subtitle, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">{subtitle}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm font-mono">
          {address}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </section>
  );
}
