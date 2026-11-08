import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Not found</h1>
      <p className="muted">That record doesn&apos;t exist or has been removed.</p>
      <Link href="/" className="btn btn-secondary">Back to dashboard</Link>
    </div>
  );
}
