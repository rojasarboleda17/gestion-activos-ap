import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Wrench } from "lucide-react";

export default function AdminOperations() {
  return (
    <AdminLayout title="Operaciones" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Operaciones" }]}>
      <EmptyState icon={Wrench} title="Módulo de Operaciones" description="Gestión de órdenes de trabajo y catálogo de operaciones. En desarrollo." />
    </AdminLayout>
  );
}
