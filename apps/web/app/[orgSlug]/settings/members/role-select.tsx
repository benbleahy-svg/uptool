"use client";

import { useRef } from "react";
import { updateMemberRole } from "./actions";

interface Props {
  orgSlug: string;
  userId: string;
  currentRole: string;
  labels: { owner: string; estimator: string; office: string };
}

export function RoleSelect({ orgSlug, userId, currentRole, labels }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateMemberRole}>
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded border border-[hsl(var(--border))] px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      >
        <option value="owner">{labels.owner}</option>
        <option value="estimator">{labels.estimator}</option>
        <option value="office">{labels.office}</option>
      </select>
    </form>
  );
}
