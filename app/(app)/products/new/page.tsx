import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createProduct } from "@/lib/actions/products";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { ProductFields } from "@/components/ProductFields";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requirePermission(can.manageCatalog);
  return (
    <>
      <PageHeader title="Add product" subtitle="Stock starts at zero; record a receipt to add stock." />
      <div className="card" style={{ maxWidth: 720 }}>
        <ActionForm action={createProduct}>
          <ProductFields />
          <div className="form-actions">
            <SubmitButton>Create product</SubmitButton>
            <Link href="/products" className="btn btn-secondary">Cancel</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
