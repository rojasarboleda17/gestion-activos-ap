import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Car } from "lucide-react";

export default function AdminVehicleDetail() {
  return (
    <AdminLayout title="Detalle del Vehículo" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Inventario", href: "/admin/vehicles" }, { label: "Detalle" }]}>
      <EmptyState icon={Car} title="Detalle del Vehículo" description="Vista completa con tabs: Resumen, Listing, Financiero, Legal, Alistamiento, Gastos, Archivos, Historial, Ventas. En desarrollo." />
    </AdminLayout>
  );
}
