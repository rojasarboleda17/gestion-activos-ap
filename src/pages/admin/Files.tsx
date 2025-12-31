import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default function AdminFiles() {
  return (
    <AdminLayout title="Archivos" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Archivos" }]}>
      <EmptyState icon={FileText} title="Visor de Archivos" description="Gestión global de archivos por vehículo. En desarrollo." />
    </AdminLayout>
  );
}
