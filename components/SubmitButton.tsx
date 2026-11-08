"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { useActionFormPending } from "./ActionForm";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const status = useFormStatus();
  const pending = useActionFormPending() ?? status.pending;
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
