import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCOP, formatKm } from "@/lib/format";
import { Plus } from "lucide-react";

interface VehicleRow {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  vehicle_class: string | null;
  stage_code: string;
  mileage_km: number | null;
  branches: { name: string } | null;
  vehicle_listing: { is_listed: boolean; listed_price_cop: number | null }[] | null;
}

export default function AdminVehicles() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, license_plate, brand, line, model_year, vehicle_class, stage_code, mileage_km, branches(name), vehicle_listing(is_listed, listed_price_cop)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100);
      setVehicles((data as VehicleRow[]) || []);
      setLoading(false);
    };
    fetchVehicles();
  }, []);

  const columns: Column<VehicleRow>[] = [
    { key: "license_plate", header: "Placa", cell: (row) => row.license_plate || "-" },
    { key: "brand", header: "Marca" },
    { key: "line", header: "Línea", cell: (row) => row.line || "-" },
    { key: "model_year", header: "Año", cell: (row) => row.model_year || "-" },
    { key: "vehicle_class", header: "Clase", cell: (row) => row.vehicle_class || "-" },
    { key: "stage_code", header: "Estado", cell: (row) => <Badge variant="outline">{row.stage_code}</Badge> },
    { key: "branch", header: "Sede", cell: (row) => row.branches?.name || "-" },
    { key: "listed", header: "Publicado", cell: (row) => row.vehicle_listing?.[0]?.is_listed ? <Badge>Sí</Badge> : <Badge variant="secondary">No</Badge> },
    { key: "price", header: "Precio", cell: (row) => formatCOP(row.vehicle_listing?.[0]?.listed_price_cop) },
    { key: "mileage", header: "Km", cell: (row) => formatKm(row.mileage_km) },
  ];

  return (
    <AdminLayout
      title="Inventario de Vehículos"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Inventario" }]}
      actions={<Button onClick={() => navigate("/admin/vehicles/new")}><Plus className="mr-2 h-4 w-4" />Crear Vehículo</Button>}
    >
      <DataTable
        columns={columns}
        data={vehicles}
        loading={loading}
        searchKeys={["license_plate", "brand", "line"]}
        searchPlaceholder="Buscar por placa, marca, línea..."
        emptyTitle="Sin vehículos"
        emptyDescription="Agrega tu primer vehículo al inventario."
        emptyAction={{ label: "Crear Vehículo", onClick: () => navigate("/admin/vehicles/new") }}
        onRowClick={(row) => navigate(`/admin/vehicles/${row.id}`)}
        getRowId={(row) => row.id}
      />
    </AdminLayout>
  );
}
