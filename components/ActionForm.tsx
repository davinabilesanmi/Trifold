"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/lib/forms";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  /** Clear the inputs after a successful submission (e.g. password forms). */
  resetOnSuccess?: boolean;
};

const PendingContext = createContext<boolean | null>(null);

/** True while the surrounding ActionForm is submitting; null outside one. */
export function useActionFormPending() {
  return useContext(PendingContext);
}

/**
 * A form wired to a server action that shows its error / success message.
 *
 * React 19 resets a form after its `action` runs, which would wipe the user's
 * input when validation fails. With JavaScript enabled we submit via
 * onSubmit instead so input is kept; without JavaScript, `action` still works.
 */
export function ActionForm({ action, children, className, resetOnSuccess }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className ?? "form"}>
      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="alert alert-success" role="status">
          {state.success}
        </p>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}
