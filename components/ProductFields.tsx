import type { Product } from "@prisma/client";
import { centsToInput } from "@/lib/format";

export function ProductFields({ product }: { product?: Product }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="sku">SKU</label>
          <input id="sku" name="sku" type="text" required maxLength={40} defaultValue={product?.sku} />
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={120} defaultValue={product?.name} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="category">Category</label>
          <input id="category" name="category" type="text" maxLength={60} defaultValue={product?.category ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="unit">Unit</label>
          <input id="unit" name="unit" type="text" maxLength={20} defaultValue={product?.unit ?? "pcs"} />
          <span className="hint">e.g. pcs, box, kg, litre</span>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="cost">Unit cost</label>
          <input id="cost" name="cost" type="text" inputMode="decimal" placeholder="0.00"
            defaultValue={product ? centsToInput(product.costCents) : ""} />
        </div>
        <div className="field">
          <label htmlFor="reorderLevel">Reorder level</label>
          <input id="reorderLevel" name="reorderLevel" type="number" min={0} step={1} defaultValue={product?.reorderLevel ?? 0} />
          <span className="hint">Flag as low stock at or below this total. 0 turns it off.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={1000} defaultValue={product?.description ?? ""} />
      </div>
    </>
  );
}
