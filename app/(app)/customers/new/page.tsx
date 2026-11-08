import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createCustomer } from "@/lib/actions/parties";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { CustomerFields } from "@/components/PartyFields";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requirePermission(can.manageCustomers);
  return (
    <>
      <PageHeader title="Add customer" />
      <div className="card" style={{ maxWidth: 720 }}>
        <ActionForm action={createCustomer}>
          <CustomerFields />
          <div className="form-actions">
            <SubmitButton>Create customer</SubmitButton>
            <Link href="/customers" className="btn btn-secondary">Cancel</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
