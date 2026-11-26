import type { Settings } from "@/lib/settings";

/** Header matching Trifold's letterhead: logo on the left, contact block on the right. */
export function LetterheadHeader({ settings, children }: { settings: Settings; children?: React.ReactNode }) {
  return (
    <header className="lh-head">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trifold-logo.png" alt={settings.businessName} className="lh-logo" width={708} height={423} />
      <div className="lh-contact">
        <div className="lh-name">{settings.businessName}</div>
        {settings.address && <div className="pre">{settings.address}</div>}
        {settings.phone && <div>Phone: {settings.phone}</div>}
        {settings.email && <div>Email: {settings.email}</div>}
        {settings.website && <div>Web: {settings.website}</div>}
        {children}
      </div>
    </header>
  );
}

export function LetterheadFooter({ settings }: { settings: Settings }) {
  const parts = [
    [settings.businessName, settings.tagline].filter(Boolean).join(" | "),
    settings.address.replace(/\s*\n\s*/g, " "),
    settings.phone,
  ].filter(Boolean);
  return <footer className="lh-foot">{parts.join(" • ")}</footer>;
}
