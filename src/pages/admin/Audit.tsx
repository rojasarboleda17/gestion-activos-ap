import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";

export default function AdminAudit() {
  return (
    <AdminLayout title="Auditoría" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Auditoría" }]}>
      <EmptyState icon={ClipboardList} title="Log de Auditoría" description="Historial de acciones del sistema. En desarrollo." />
    </AdminLayout>
  );
}
