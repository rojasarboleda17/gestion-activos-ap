import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingCart } from "lucide-react";

export default function AdminSales() {
  return (
    <AdminLayout title="Ventas" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Ventas" }]}>
      <EmptyState icon={ShoppingCart} title="Módulo de Ventas" description="Gestión de clientes, reservas, ventas y pagos. En desarrollo." />
    </AdminLayout>
  );
}
