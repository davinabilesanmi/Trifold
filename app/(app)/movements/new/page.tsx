import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { activeOptions } from "@/lib/queries";
import { canUseLocation } from "@/lib/scope";
import { createMovement } from "@/lib/actions/movements";
import { MOVEMENT_DESCRIPTIONS, MOVEMENT_LABELS, MOVEMENT_TYPES, isMovementType, type MovementType } from "@/lib/stock";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Record movement" };

type Search = { type?: string; product?: string; returnTo?: string };
type Option = { id: string; label: string };

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: Option[]; defaultValue?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} required defaultValue={defaultValue ?? ""}>
        <option value="" disabled>Choose…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default async function NewMovementPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission(can.recordMovements);
  const sp = await searchParams;
  const type: MovementType = isMovementType(sp.type) ? sp.type : "RECEIPT";
  const { products, locations: allLocations } = await activeOptions();
  const locations = allLocations.filter((l) => canUseLocation(user, l.id));
  const productOptions = products.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` }));
  const locationOptions = locations.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }));
  const returnTo = sp.returnTo?.startsWith("/") && !sp.returnTo.startsWith("//") ? sp.returnTo : undefined;
  const cancelHref = returnTo ?? "/movements";

  const tabHref = (t: MovementType) => {
    const qs = new URLSearchParams({ type: t });
    if (sp.product) qs.set("product", sp.product);
    if (returnTo) qs.set("returnTo", returnTo);
    return `/movements/new?${qs}`;
  };

  const missing = products.length === 0 ? "products" : locations.length === 0 ? "locations" : null;

  return (
    <>
      <PageHeader title="Record stock movement" />
      <nav className="tabs" aria-label="Movement type">
        {MOVEMENT_TYPES.map((t) => (
          <Link key={t} href={tabHref(t)} className={t === type ? "tab active" : "tab"} aria-current={t === type ? "page" : undefined}>
            {MOVEMENT_LABELS[t]}
          </Link>
        ))}
      </nav>
      <div className="card" style={{ maxWidth: 720 }}>
        <p className="muted" style={{ marginTop: 0 }}>{MOVEMENT_DESCRIPTIONS[type]}</p>
        {missing ? (
          <p className="alert alert-warn">There are no active {missing} yet. Add some first.</p>
        ) : (
          <ActionForm action={createMovement} key={type}>
            <input type="hidden" name="type" value={type} />
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <Select name="productId" label="Product" options={productOptions} defaultValue={sp.product} />
            <div className="form-row">
              {(type === "ISSUE" || type === "TRANSFER") && (
                <Select name="fromLocationId" label={type === "TRANSFER" ? "From location" : "Location"} options={locationOptions} />
              )}
              {(type === "RECEIPT" || type === "TRANSFER") && (
                <Select name="toLocationId" label={type === "TRANSFER" ? "To location" : "Location"}
                  options={type === "TRANSFER" ? allLocations.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` })) : locationOptions} />
              )}
              {type === "ADJUSTMENT" && <Select name="locationId" label="Location" options={locationOptions} />}
              {type === "ADJUSTMENT" ? (
                <div className="field">
                  <label htmlFor="countedQuantity">Counted quantity</label>
                  <input id="countedQuantity" name="countedQuantity" type="number" min={0} step={1} required />
                  <span className="hint">The actual quantity on the shelf. The difference is recorded.</span>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="quantity">Quantity</label>
                  <input id="quantity" name="quantity" type="number" min={1} step={1} required />
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" name="reference" type="text" maxLength={100}
                placeholder={type === "RECEIPT" ? "Supplier invoice / PO number" : type === "ISSUE" ? "Order or invoice number" : "Optional"} />
            </div>
            <div className="field">
              <label htmlFor="note">Note</label>
              <textarea id="note" name="note" maxLength={500} />
            </div>
            <div className="form-actions">
              <SubmitButton pendingText="Recording…">Record {MOVEMENT_LABELS[type].toLowerCase()}</SubmitButton>
              <Link href={cancelHref} className="btn btn-secondary">Cancel</Link>
            </div>
          </ActionForm>
        )}
      </div>
    </>
  );
}
