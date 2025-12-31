import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export default function AdminUsers() {
  return (
    <AdminLayout title="Usuarios" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Usuarios" }]}>
      <EmptyState icon={Users} title="Gestión de Usuarios" description="Gestión de usuarios, roles y permisos. En desarrollo." />
    </AdminLayout>
  );
}
