"use client";

import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1>Something went wrong</h1>
      <p className="muted">
        Nothing was saved. Try again, and if it keeps happening, tell your administrator
        {error.digest ? <> and quote this code: <code>{error.digest}</code></> : null}.
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn btn-secondary">Back to dashboard</Link>
      </div>
    </div>
  );
}
