"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@uptool/ui";
import { connectImapAction } from "./actions";

export interface ImapStrings {
  button: string;
  dialog_title: string;
  email: string;
  server: string;
  port: string;
  tls: string;
  password: string;
  connecting: string;
  connect: string;
  connect_failed: string;
}

export function ImapConnectDialog({ orgSlug, strings }: { orgSlug: string; strings: ImapStrings }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [host, setHost] = useState("");
  const [tls, setTls] = useState(true);
  const [port, setPort] = useState(993);
  const [portTouched, setPortTouched] = useState(false);
  const [password, setPassword] = useState("");

  function reset() {
    setEmail("");
    setHost("");
    setTls(true);
    setPort(993);
    setPortTouched(false);
    setPassword("");
    setError(null);
  }

  // Default port tracks the TLS toggle until the user edits it manually.
  function handleTls(next: boolean) {
    setTls(next);
    if (!portTouched) setPort(next ? 993 : 143);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await connectImapAction(orgSlug, {
        email,
        imapHost: host,
        imapPort: port,
        imapTls: tls,
        password,
      });
      if (res.ok) {
        setOpen(false);
        reset();
      } else {
        setError(strings.connect_failed);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-white px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <ImapIcon />
          {strings.button}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{strings.dialog_title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="imap-email">{strings.email}</Label>
            <Input
              id="imap-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imap-host">{strings.server}</Label>
            <Input
              id="imap-host"
              type="text"
              required
              placeholder="mail.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="space-y-1.5 w-28">
              <Label htmlFor="imap-port">{strings.port}</Label>
              <Input
                id="imap-port"
                type="number"
                required
                min={1}
                max={65535}
                value={port}
                onChange={(e) => {
                  setPortTouched(true);
                  setPort(Number(e.target.value));
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2.5 select-none">
              <input
                type="checkbox"
                checked={tls}
                onChange={(e) => handleTls(e.target.checked)}
                className="h-4 w-4 rounded border-[hsl(var(--border))]"
              />
              {strings.tls}
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imap-password">{strings.password}</Label>
            <Input
              id="imap-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? strings.connecting : strings.connect}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImapIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>IMAP</title>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}
