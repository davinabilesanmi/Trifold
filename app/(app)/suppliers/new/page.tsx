import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createSupplier } from "@/lib/actions/parties";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { SupplierFields } from "@/components/PartyFields";

export const metadata = { title: "Add supplier" };

export default async function NewSupplierPage() {
  await requirePermission(can.managePurchasing);
  return (
    <>
      <PageHeader title="Add supplier" />
      <div className="card" style={{ maxWidth: 720 }}>
        <ActionForm action={createSupplier}>
          <SupplierFields />
          <div className="form-actions">
            <SubmitButton>Create supplier</SubmitButton>
            <Link href="/suppliers" className="btn btn-secondary">Cancel</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
