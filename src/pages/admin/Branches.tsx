import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export default function AdminBranches() {
  return (
    <AdminLayout title="Sedes" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Sedes" }]}>
      <EmptyState icon={Building2} title="Gestión de Sedes" description="Administrar las sedes de la organización. En desarrollo." />
    </AdminLayout>
  );
}
