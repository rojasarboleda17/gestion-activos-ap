import { useEffect, useState, useMemo, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatCOP, formatKm, formatDate } from "@/lib/format";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";

import { VehicleFilters } from "@/components/vehicle/VehicleFilters";
import { VehicleKanban } from "@/components/vehicle/VehicleKanban";
import { VehicleQuickEdit } from "@/components/vehicle/VehicleQuickEdit";
import { logger } from "@/lib/logger";

interface VehicleStage {
  code: string;
  name: string;
  sort_order: number;
}

interface Branch {
  id: string;
  name: string;
  is_active?: boolean;
}

interface VehicleListing {
  vehicle_id: string;
  is_listed: boolean;
  listed_price_cop: number | null;
}

interface VehicleCompliance {
  vehicle_id: string;
  soat_expires_at: string | null;
  tecnomecanica_expires_at: string | null;
  has_fines: boolean;
  fines_amount_cop: number | null;
}

interface VehicleRow {
  id: string;
  license_plate: string | null;
  vin: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  vehicle_class: string | null;
  stage_code: string;
  mileage_km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  color: string | null;
  branch_id: string | null;
  is_archived: boolean;
  created_at: string;
  // Joined data
  branch_name: string | null;
  stage_name: string;
  is_listed: boolean;
  listed_price_cop: number | null;
  soat_expires_at: string | null;
  tecnomecanica_expires_at: string | null;
  has_fines: boolean;
  fines_amount_cop: number | null;
}

interface Filters {
  stage_code: string;
  branch_id: string;
  vehicle_class: string;
  is_listed: string;
  include_archived: boolean;
}

const DEFAULT_FILTERS: Filters = {
  stage_code: "all",
  branch_id: "all",
  vehicle_class: "all",
  is_listed: "all",
  include_archived: false,
};

export default function AdminVehicles() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Quick edit modal
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      // Parallel fetches
      const [vehiclesRes, stagesRes, branchesRes, listingsRes, complianceRes] =
        await Promise.all([
          supabase
            .from("vehicles")
            .select(
              "id, license_plate, vin, brand, line, model_year, vehicle_class, stage_code, mileage_km, fuel_type, transmission, color, branch_id, is_archived, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("vehicle_stages")
            .select("code, name, sort_order")
            .order("sort_order"),
          supabase
            .from("branches")
            .select("id, name, is_active")
            .order("name"),
          supabase
            .from("vehicle_listing")
            .select("vehicle_id, is_listed, listed_price_cop"),
          supabase
            .from("vehicle_compliance")
            .select(
              "vehicle_id, soat_expires_at, tecnomecanica_expires_at, has_fines, fines_amount_cop"
            ),
        ]);

      const stagesData = stagesRes.data || [];
      const branchesData = branchesRes.data || [];
      const listingsMap = new Map<string, VehicleListing>();
      const complianceMap = new Map<string, VehicleCompliance>();

      (listingsRes.data || []).forEach((l) =>
        listingsMap.set(l.vehicle_id, l)
      );
      (complianceRes.data || []).forEach((c) =>
        complianceMap.set(c.vehicle_id, c)
      );

      const stagesMap = new Map(stagesData.map((s) => [s.code, s.name]));
      const branchesMap = new Map(branchesData.map((b) => [b.id, b.name]));

      const enrichedVehicles: VehicleRow[] = (vehiclesRes.data || []).map(
        (v) => {
          const listing = listingsMap.get(v.id);
          const compliance = complianceMap.get(v.id);
          return {
            ...v,
            branch_name: v.branch_id ? branchesMap.get(v.branch_id) || null : null,
            stage_name: stagesMap.get(v.stage_code) || v.stage_code,
            is_listed: listing?.is_listed || false,
            listed_price_cop: listing?.listed_price_cop || null,
            soat_expires_at: compliance?.soat_expires_at || null,
            tecnomecanica_expires_at: compliance?.tecnomecanica_expires_at || null,
            has_fines: compliance?.has_fines || false,
            fines_amount_cop: compliance?.fines_amount_cop || null,
          };
        }
      );

      setVehicles(enrichedVehicles);
      setStages(stagesData);
      setBranches(branchesData);
    } catch (err) {
      logger.error("Error fetching vehicles:", err);
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply filters
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (!filters.include_archived && v.is_archived) return false;
      if (filters.stage_code !== "all" && v.stage_code !== filters.stage_code)
        return false;
      if (filters.branch_id !== "all" && v.branch_id !== filters.branch_id)
        return false;
      if (
        filters.vehicle_class !== "all" &&
        v.vehicle_class !== filters.vehicle_class
      )
        return false;
      if (filters.is_listed === "true" && !v.is_listed) return false;
      if (filters.is_listed === "false" && v.is_listed) return false;
      return true;
    });
  }, [vehicles, filters]);

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleArchive = async (vehicle: VehicleRow) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ is_archived: !vehicle.is_archived })
        .eq("id", vehicle.id);

      if (error) throw error;
      toast.success(
        vehicle.is_archived ? "Vehículo desarchivado" : "Vehículo archivado"
      );
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleQuickEdit = (vehicle: VehicleRow) => {
    setEditVehicle(vehicle);
    setQuickEditOpen(true);
  };

  const columns: Column<VehicleRow>[] = [
    {
      key: "license_plate",
      header: "Placa",
      cell: (row) =>
        row.license_plate ? (
          <span className="font-mono text-sm bg-secondary px-2 py-0.5 rounded">
            {row.license_plate}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "brand_line",
      header: "Marca / Línea",
      cell: (row) => (
        <div>
          <span className="font-medium">{row.brand}</span>
          {row.line && (
            <span className="text-muted-foreground ml-1">{row.line}</span>
          )}
        </div>
      ),
    },
    {
      key: "model_year",
      header: "Año",
      cell: (row) => row.model_year || "—",
    },
    {
      key: "vehicle_class",
      header: "Clase",
      cell: (row) => row.vehicle_class || "—",
    },
    {
      key: "stage_code",
      header: "Estado",
      cell: (row) => (
        <Badge
          variant={row.is_archived ? "secondary" : "outline"}
          className="whitespace-nowrap"
        >
          {row.stage_name}
        </Badge>
      ),
    },
    {
      key: "branch_name",
      header: "Sede",
      cell: (row) => row.branch_name || "—",
    },
    {
      key: "mileage_km",
      header: "Km",
      cell: (row) => formatKm(row.mileage_km),
    },
    {
      key: "listed_price_cop",
      header: "Precio",
      cell: (row) =>
        row.is_listed ? (
          formatCOP(row.listed_price_cop)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "soat_expires_at",
      header: "SOAT",
      cell: (row) => {
        if (!row.soat_expires_at) return "—";
        const date = new Date(row.soat_expires_at);
        const isExpired = date < new Date();
        const isNear =
          date < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return (
          <span
            className={
              isExpired
                ? "text-destructive"
                : isNear
                ? "text-warning"
                : ""
            }
          >
            {formatDate(row.soat_expires_at)}
          </span>
        );
      },
    },
    {
      key: "tecnomecanica_expires_at",
      header: "Tecno",
      cell: (row) => {
        if (!row.tecnomecanica_expires_at) return "—";
        const date = new Date(row.tecnomecanica_expires_at);
        const isExpired = date < new Date();
        const isNear =
          date < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return (
          <span
            className={
              isExpired
                ? "text-destructive"
                : isNear
                ? "text-warning"
                : ""
            }
          >
            {formatDate(row.tecnomecanica_expires_at)}
          </span>
        );
      },
    },
    {
      key: "has_fines",
      header: "Multas",
      cell: (row) =>
        row.has_fines ? (
          <Badge variant="destructive">
            {formatCOP(row.fines_amount_cop)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/vehicles/${row.id}`);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleQuickEdit(row);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(row);
              }}
            >
              {row.is_archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Desarchivar
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12",
    },
  ];

  return (
    <AdminLayout
      title="Inventario de Vehículos"
      breadcrumbs={[
        { label: "Inicio", href: "/admin/vehicles" },
        { label: "Inventario" },
      ]}
      actions={
        <Button onClick={() => navigate("/admin/vehicles/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Vehículo
        </Button>
      }
    >
      <div className="space-y-4">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "list" | "kanban")}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <TabsList>
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
            </TabsList>

            <VehicleFilters
              filters={filters}
              stages={stages}
              branches={branches}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </div>

          <TabsContent value="list" className="mt-4">
            <DataTable
              columns={columns}
              data={filteredVehicles}
              loading={loading}
              searchKeys={["license_plate", "vin", "brand", "line"]}
              searchPlaceholder="Buscar por placa, VIN, marca, línea..."
              emptyTitle="Sin vehículos"
              emptyDescription="Agrega tu primer vehículo al inventario."
              emptyAction={{
                label: "Crear Vehículo",
                onClick: () => navigate("/admin/vehicles/new"),
              }}
              onRowClick={(row) => navigate(`/admin/vehicles/${row.id}`)}
              getRowId={(row) => row.id}
              pageSize={15}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4">
            <VehicleKanban
              vehicles={filteredVehicles}
              stages={stages}
              onRefresh={fetchData}
              onVehicleClick={(id) => navigate(`/admin/vehicles/${id}`)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <VehicleQuickEdit
        vehicle={editVehicle}
        stages={stages}
        branches={branches}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
        onSave={fetchData}
      />
    </AdminLayout>
  );
}
