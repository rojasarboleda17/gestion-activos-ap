import { useEffect, useState, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronLeft,
  ChevronRight,
  Search,
  X,
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
  const [kanbanVehicles, setKanbanVehicles] = useState<VehicleRow[]>([]);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKanban, setLoadingKanban] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const addQueryFilters = useCallback(
    <T extends ReturnType<typeof supabase.from>>(query: T) => {
      let q = query;
      if (!filters.include_archived) q = q.eq("is_archived", false);
      if (filters.stage_code !== "all") q = q.eq("stage_code", filters.stage_code);
      if (filters.branch_id !== "all") q = q.eq("branch_id", filters.branch_id);
      if (filters.vehicle_class !== "all") {
        q = q.eq("vehicle_class", filters.vehicle_class);
      }
      if (filters.is_listed === "true") q = q.eq("is_listed", true);
      if (filters.is_listed === "false") q = q.eq("is_listed", false);
      return q;
    },
    [filters]
  );

  const escapeIlike = useCallback((value: string) => value.replace(/[%_,]/g, ""), []);

  const addSearchFilter = useCallback(
    <T extends ReturnType<typeof supabase.from>>(query: T) => {
      const searchTerm = search.trim();
      if (!searchTerm) return query;

      const safe = escapeIlike(searchTerm);
      return query.or(
        `license_plate.ilike.%${safe}%,vin.ilike.%${safe}%,brand.ilike.%${safe}%,line.ilike.%${safe}%`
      );
    },
    [escapeIlike, search]
  );

  // Quick edit modal
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const offset = (page - 1) * pageSize;
      const from = offset;
      const to = offset + pageSize - 1;

      const vehiclesQuery = addSearchFilter(
        addQueryFilters(
        supabase
          .from("inventory_vehicle_overview")
          .select(
            "id, license_plate, vin, brand, line, model_year, vehicle_class, stage_code, mileage_km, fuel_type, transmission, color, branch_id, is_archived, created_at, branch_name, stage_name, is_listed, listed_price_cop, soat_expires_at, tecnomecanica_expires_at, has_fines, fines_amount_cop",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
          .range(from, to)
        )
      );

      const [vehiclesRes, stagesRes, branchesRes] =
        await Promise.all([
          vehiclesQuery,
          supabase
            .from("vehicle_stages")
            .select("code, name, sort_order")
            .order("sort_order"),
          supabase
            .from("branches")
            .select("id, name, is_active")
            .order("name"),
        ]);

      const stagesData = stagesRes.data || [];
      const branchesData = branchesRes.data || [];
      setVehicles((vehiclesRes.data || []) as VehicleRow[]);
      setTotalCount(vehiclesRes.count || 0);
      setStages(stagesData);
      setBranches(branchesData);
    } catch (err) {
      logger.error("Error fetching vehicles:", err);
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, [addQueryFilters, addSearchFilter, page, pageSize]);

  const fetchKanbanData = useCallback(async () => {
    if (viewMode !== "kanban") return;

    setLoadingKanban(true);
    try {
      const vehiclesQuery = addSearchFilter(
        addQueryFilters(
          supabase
            .from("inventory_vehicle_overview")
            .select(
              "id, license_plate, vin, brand, line, model_year, vehicle_class, stage_code, mileage_km, fuel_type, transmission, color, branch_id, is_archived, created_at, branch_name, stage_name, is_listed, listed_price_cop, soat_expires_at, tecnomecanica_expires_at, has_fines, fines_amount_cop"
            )
            .order("created_at", { ascending: false })
        )
      );

      const vehiclesRes = await vehiclesQuery;
      setKanbanVehicles((vehiclesRes.data || []) as VehicleRow[]);
    } catch (err) {
      logger.error("Error fetching kanban vehicles:", err);
      toast.error("Error al cargar kanban");
    } finally {
      setLoadingKanban(false);
    }
  }, [addQueryFilters, addSearchFilter, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchKanbanData();
  }, [fetchKanbanData]);

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const handleClearFilters = () => {
    setPage(1);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, VIN, marca, línea..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Filas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / página</SelectItem>
                  <SelectItem value="15">15 / página</SelectItem>
                  <SelectItem value="30">30 / página</SelectItem>
                  <SelectItem value="50">50 / página</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DataTable
              columns={columns}
              data={vehicles}
              loading={loading}
              searchable={false}
              emptyTitle="Sin vehículos"
              emptyDescription="Agrega tu primer vehículo al inventario."
              emptyAction={{
                label: "Crear Vehículo",
                onClick: () => navigate("/admin/vehicles/new"),
              }}
              onRowClick={(row) => navigate(`/admin/vehicles/${row.id}`)}
              getRowId={(row) => row.id}
              pageSize={Math.max(vehicles.length, 1)}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                {totalCount === 0
                  ? "0 resultados"
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)} de ${totalCount}`}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs sm:text-sm min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kanban" className="mt-4">
            <VehicleKanban
              vehicles={kanbanVehicles}
              stages={stages}
              onRefresh={fetchKanbanData}
              onVehicleClick={(id) => navigate(`/admin/vehicles/${id}`)}
            />
            {loadingKanban && (
              <p className="text-sm text-muted-foreground mt-2">Cargando kanban...</p>
            )}
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
