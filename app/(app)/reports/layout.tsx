import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { ReportTabs } from "@/components/ReportTabs";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission(can.viewReports);
  return (
    <>
      <div className="no-print"><PageHeader title="Reports" subtitle="Downloads open in Excel. Use your browser's print button for paper copies." /></div>
      <ReportTabs financials={can.viewFinancials(user)} />
      {children}
    </>
  );
}
