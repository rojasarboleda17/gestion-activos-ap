import { useState, useEffect, useMemo, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Wrench,
  Plus,
  Pencil,
  ClipboardList,
  Search,
  X,
  Car,
  Briefcase,
  Eye,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { WorkOrderSheet } from "@/components/operations/WorkOrderSheet";
import { logger } from "@/lib/logger";

interface Operation {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  scope: string;
  financial_kind: string;
  is_active: boolean;
}

interface Vehicle {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  stage_code: string;
}

interface WorkOrder {
  id: string;
  status: string;
  scope: string;
  notes: string | null;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  vehicle_id: string | null;
  opened_by: string | null;
  vehicle: Vehicle | null;
  stage_name: string;
  items_total: number;
  items_done: number;
  items_pending: number;
  items_blocked: number;
}

const SCOPES = [
  { value: "vehicle", label: "Vehículo" },
  { value: "business", label: "Negocio" },
];

const CATEGORIES = [
  { value: "mecánica", label: "Mecánica" },
  { value: "eléctrica", label: "Eléctrica" },
  { value: "carrocería", label: "Carrocería" },
  { value: "limpieza", label: "Limpieza" },
  { value: "documentación", label: "Documentación" },
  { value: "administrativo", label: "Administrativo" },
  { value: "otro", label: "Otro" },
];

const WO_STATUSES = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertas" },
  { value: "closed", label: "Cerradas" },
];

export default function AdminOperations() {
  const { profile } = useAuth();

  // Data
  const [operations, setOperations] = useState<Operation[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stages, setStages] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Vehicle Work Orders
  const [vwoStatusFilter, setVwoStatusFilter] = useState("open");
  const [vwoSearch, setVwoSearch] = useState("");

  // Filters for Business Work Orders
  const [bwoStatusFilter, setBwoStatusFilter] = useState("open");
  const [bwoSearch, setBwoSearch] = useState("");

  // Filters for Catalog
  const [catSearch, setCatSearch] = useState("");
  const [catScopeFilter, setCatScopeFilter] = useState("all");
  const [catCategoryFilter, setCatCategoryFilter] = useState("all");

  // Operation Dialog
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [opForm, setOpForm] = useState({
    code: "", name: "", description: "", category: "", scope: "vehicle", financial_kind: "expense",
  });
  const [opSaving, setOpSaving] = useState(false);

  // Create Vehicle Work Order Dialog
  const [createVwoDialogOpen, setCreateVwoDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [creatingVwo, setCreatingVwo] = useState(false);

  // Create Business Work Order Dialog
  const [createBwoDialogOpen, setCreateBwoDialogOpen] = useState(false);
  const [bwoNotes, setBwoNotes] = useState("");
  const [creatingBwo, setCreatingBwo] = useState(false);

  // Sheet for managing work order
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [opsRes, woRes, vehiclesRes, stagesRes, itemsRes] = await Promise.all([
        supabase.from("operation_catalog").select("*").order("code"),
        supabase
          .from("work_orders")
          .select("*, vehicles(id, license_plate, brand, line, model_year, stage_code)")
          .order("opened_at", { ascending: false })
          .limit(300),
        supabase
          .from("vehicles")
          .select("id, license_plate, brand, line, model_year, stage_code")
          .eq("is_archived", false)
          .order("license_plate"),
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
        supabase.from("work_order_items").select("work_order_id, status"),
      ]);

      setOperations(opsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setStages(stagesRes.data || []);

      const stageMap = new Map((stagesRes.data || []).map((s) => [s.code, s.name]));

      const itemCounts: Record<
        string,
        { total: number; done: number; pending: number; blocked: number }
      > = {};
      (itemsRes.data || []).forEach((item) => {
        if (!itemCounts[item.work_order_id]) {
          itemCounts[item.work_order_id] = { total: 0, done: 0, pending: 0, blocked: 0 };
        }
        itemCounts[item.work_order_id].total++;
        if (item.status === "done") itemCounts[item.work_order_id].done++;
        if (item.status === "pending" || item.status === "in_progress")
          itemCounts[item.work_order_id].pending++;
        if (item.status === "blocked") itemCounts[item.work_order_id].blocked++;
      });

      const enrichedWOs: WorkOrder[] = (woRes.data || []).map((wo: WorkOrder & { vehicles: Vehicle | null }) => ({
        ...wo,
        vehicle: wo.vehicles,
        stage_name: wo.vehicles
          ? stageMap.get(wo.vehicles.stage_code) || wo.vehicles.stage_code
          : "—",
        items_total: itemCounts[wo.id]?.total || 0,
        items_done: itemCounts[wo.id]?.done || 0,
        items_pending: itemCounts[wo.id]?.pending || 0,
        items_blocked: itemCounts[wo.id]?.blocked || 0,
      }));

      setWorkOrders(enrichedWOs);
    } catch (err) {
      logger.error("Error fetching operations data:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter: Vehicle Work Orders
  const vehicleWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => wo.vehicle_id !== null);
  }, [workOrders]);

  const filteredVehicleWOs = useMemo(() => {
    return vehicleWorkOrders.filter((wo) => {
      if (vwoStatusFilter !== "all" && wo.status !== vwoStatusFilter) return false;
      if (vwoSearch.trim()) {
        const search = vwoSearch.toLowerCase();
        const plate = wo.vehicle?.license_plate?.toLowerCase() || "";
        const brand = wo.vehicle?.brand?.toLowerCase() || "";
        const line = wo.vehicle?.line?.toLowerCase() || "";
        if (!plate.includes(search) && !brand.includes(search) && !line.includes(search))
          return false;
      }
      return true;
    });
  }, [vehicleWorkOrders, vwoStatusFilter, vwoSearch]);

  // Filter: Business Work Orders
  const businessWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => wo.vehicle_id === null);
  }, [workOrders]);

  const filteredBusinessWOs = useMemo(() => {
    return businessWorkOrders.filter((wo) => {
      if (bwoStatusFilter !== "all" && wo.status !== bwoStatusFilter) return false;
      if (bwoSearch.trim()) {
        const search = bwoSearch.toLowerCase();
        const notes = wo.notes?.toLowerCase() || "";
        if (!notes.includes(search)) return false;
      }
      return true;
    });
  }, [businessWorkOrders, bwoStatusFilter, bwoSearch]);

  // Filtered Operations
  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      if (catSearch.trim()) {
        const search = catSearch.toLowerCase();
        if (!op.code.toLowerCase().includes(search) && !op.name.toLowerCase().includes(search))
          return false;
      }
      if (catScopeFilter !== "all" && op.scope !== catScopeFilter) return false;
      if (catCategoryFilter !== "all" && op.category !== catCategoryFilter) return false;
      return true;
    });
  }, [operations, catSearch, catScopeFilter, catCategoryFilter]);

  // Operation CRUD handlers
  const openCreateOpDialog = () => {
    setEditingOp(null);
    setOpForm({ code: "", name: "", description: "", category: "", scope: "vehicle", financial_kind: "expense" });
    setOpDialogOpen(true);
  };

  const openEditOpDialog = (op: Operation) => {
    setEditingOp(op);
    setOpForm({
      code: op.code,
      name: op.name,
      description: op.description || "",
      category: op.category || "",
      scope: op.scope,
      financial_kind: op.financial_kind || "expense",
    });
    setOpDialogOpen(true);
  };

  const handleSaveOperation = async () => {
    if (!opForm.code.trim() || !opForm.name.trim()) {
      toast.error("Código y nombre son requeridos");
      return;
    }
    if (!profile?.org_id) return;

    setOpSaving(true);
    try {
      const payload = {
        code: opForm.code.trim().toUpperCase(),
        name: opForm.name.trim(),
        description: opForm.description.trim() || null,
        category: opForm.category || null,
        scope: opForm.scope,
        financial_kind: opForm.financial_kind || "expense",
      };

      if (editingOp) {
        const { error } = await supabase
          .from("operation_catalog")
          .update(payload)
          .eq("id", editingOp.id);
        if (error) throw error;
        toast.success("Operación actualizada");
      } else {
        const { error } = await supabase.from("operation_catalog").insert([{
          ...payload,
          org_id: profile.org_id,
        }]);
        if (error) throw error;
        toast.success("Operación creada");
      }

      setOpDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setOpSaving(false);
    }
  };

  const toggleOpActive = async (op: Operation) => {
    try {
      const { error } = await supabase
        .from("operation_catalog")
        .update({ is_active: !op.is_active })
        .eq("id", op.id);
      if (error) throw error;
      toast.success(op.is_active ? "Operación desactivada" : "Operación activada");
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // Create Vehicle Work Order
  const handleCreateVehicleWO = async () => {
    if (!profile?.org_id || !selectedVehicleId) {
      toast.error("Selecciona un vehículo");
      return;
    }

    setCreatingVwo(true);
    try {
      const { data: existing } = await supabase
        .from("work_orders")
        .select("id")
        .eq("vehicle_id", selectedVehicleId)
        .eq("status", "open")
        .maybeSingle();

      if (existing) {
        // Open existing work order in sheet
        const wo = workOrders.find((w) => w.id === existing.id);
        if (wo) {
          setSelectedWorkOrder(wo);
          setSheetOpen(true);
        }
        toast.info("Este vehículo ya tiene una orden abierta");
        setCreatingVwo(false);
        setCreateVwoDialogOpen(false);
        return;
      }

      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          org_id: profile.org_id,
          vehicle_id: selectedVehicleId,
          scope: "vehicle",
          status: "open",
          opened_by: profile.id,
        })
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Orden creada");
      setCreateVwoDialogOpen(false);
      setSelectedVehicleId("");
      await fetchData();

      // Open the new work order in sheet
      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      setSelectedWorkOrder({
        ...data,
        vehicle: vehicle || null,
        stage_name: vehicle ? stages.find((s) => s.code === vehicle.stage_code)?.name || vehicle.stage_code : "—",
        items_total: 0,
        items_done: 0,
        items_pending: 0,
        items_blocked: 0,
      });
      setSheetOpen(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al crear orden"));
    } finally {
      setCreatingVwo(false);
    }
  };

  // Create Business Work Order
  const handleCreateBusinessWO = async () => {
    if (!profile?.org_id) return;

    setCreatingBwo(true);
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          org_id: profile.org_id,
          vehicle_id: null,
          scope: "business",
          status: "open",
          opened_by: profile.id,
          notes: bwoNotes.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Orden de negocio creada");
      setCreateBwoDialogOpen(false);
      setBwoNotes("");
      await fetchData();

      // Open the new work order in sheet
      setSelectedWorkOrder({
        ...data,
        vehicle: null,
        stage_name: "—",
        items_total: 0,
        items_done: 0,
        items_pending: 0,
        items_blocked: 0,
      });
      setSheetOpen(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al crear orden"));
    } finally {
      setCreatingBwo(false);
    }
  };

  // Open work order in sheet
  const openWorkOrderSheet = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setSheetOpen(true);
  };

  if (loading) {
    return (
      <AdminLayout
        title="Operaciones"
        breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Operaciones" }]}
      >
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  const renderWOTable = (
    orders: WorkOrder[],
    isVehicle: boolean
  ) => {
    if (orders.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Sin órdenes"
          description={isVehicle ? "No hay órdenes de alistamiento." : "No hay órdenes de negocio."}
          action={{
            label: isVehicle ? "Crear Orden" : "Crear Orden de Negocio",
            onClick: () => (isVehicle ? setCreateVwoDialogOpen(true) : setCreateBwoDialogOpen(true)),
          }}
        />
      );
    }

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden md:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {isVehicle && <TableHead>Vehículo</TableHead>}
                {!isVehicle && <TableHead>Notas</TableHead>}
                {isVehicle && <TableHead>Estado Vehículo</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Pendientes</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((wo) => {
                const progress = wo.items_total > 0 ? Math.round((wo.items_done / wo.items_total) * 100) : 0;
                return (
                  <TableRow key={wo.id}>
                    {isVehicle && (
                      <TableCell>
                        {wo.vehicle ? (
                          <div>
                            <span className="font-mono text-sm bg-secondary px-2 py-0.5 rounded">
                              {wo.vehicle.license_plate || "S/P"}
                            </span>
                            <span className="ml-2 text-sm">
                              {wo.vehicle.brand} {wo.vehicle.line || ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {!isVehicle && (
                      <TableCell className="max-w-[200px] truncate">
                        {wo.notes || "Sin notas"}
                      </TableCell>
                    )}
                    {isVehicle && (
                      <TableCell>
                        <Badge variant="outline">{wo.stage_name}</Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={wo.status === "open" ? "default" : "secondary"}>
                        {wo.status === "open" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {wo.items_done}/{wo.items_total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {wo.items_pending > 0 && (
                        <Badge variant="secondary" className="mr-1">
                          {wo.items_pending}
                        </Badge>
                      )}
                      {wo.items_blocked > 0 && (
                        <Badge variant="destructive">{wo.items_blocked} bloq</Badge>
                      )}
                      {wo.items_pending === 0 && wo.items_blocked === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(wo.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openWorkOrderSheet(wo)}>
                        <Eye className="h-4 w-4 mr-1" />
                        {wo.status === "open" ? "Gestionar" : "Ver"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 md:hidden">
          {orders.map((wo) => {
            const progress = wo.items_total > 0 ? Math.round((wo.items_done / wo.items_total) * 100) : 0;
            return (
              <Card key={wo.id} className="cursor-pointer" onClick={() => openWorkOrderSheet(wo)}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      {isVehicle && wo.vehicle ? (
                        <>
                          <span className="font-mono text-sm bg-secondary px-2 py-0.5 rounded">
                            {wo.vehicle.license_plate || "S/P"}
                          </span>
                          <p className="text-sm mt-1">
                            {wo.vehicle.brand} {wo.vehicle.line || ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm">{wo.notes || "Orden de negocio"}</p>
                      )}
                    </div>
                    <Badge variant={wo.status === "open" ? "default" : "secondary"}>
                      {wo.status === "open" ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground">
                      {wo.items_done}/{wo.items_total}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{isVehicle ? wo.stage_name : "Negocio"}</span>
                    <span>{formatDate(wo.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <AdminLayout
      title="Centro de Operaciones"
      breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Operaciones" }]}
    >
      <Tabs defaultValue="vehicles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vehicles" className="gap-2">
            <Car className="h-4 w-4" />
            Alistamiento Vehículos
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Operaciones Negocio
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <Wrench className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
        </TabsList>

        {/* Tab: Vehicle Work Orders */}
        <TabsContent value="vehicles" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, marca..."
                  value={vwoSearch}
                  onChange={(e) => setVwoSearch(e.target.value)}
                  className="pl-9 w-64"
                />
                {vwoSearch && (
                  <button
                    onClick={() => setVwoSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={vwoStatusFilter} onValueChange={setVwoStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WO_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateVwoDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Orden
            </Button>
          </div>
          {renderWOTable(filteredVehicleWOs, true)}
        </TabsContent>

        {/* Tab: Business Work Orders */}
        <TabsContent value="business" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en notas..."
                  value={bwoSearch}
                  onChange={(e) => setBwoSearch(e.target.value)}
                  className="pl-9 w-64"
                />
                {bwoSearch && (
                  <button
                    onClick={() => setBwoSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={bwoStatusFilter} onValueChange={setBwoStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WO_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateBwoDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Orden Negocio
            </Button>
          </div>

          <Card className="border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Nota:</strong> Los gastos de negocio no se pueden registrar en vehicle_expenses (requiere vehicle_id).
                Registra costos estimados en las notas de cada ítem.
              </p>
            </CardContent>
          </Card>

          {renderWOTable(filteredBusinessWOs, false)}
        </TabsContent>

        {/* Tab: Catalog */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar código o nombre..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={catScopeFilter} onValueChange={setCatScopeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos scopes</SelectItem>
                  {SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={catCategoryFilter} onValueChange={setCatCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorías</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreateOpDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Operación
            </Button>
          </div>

          {filteredOperations.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Sin operaciones"
              description="No hay operaciones en el catálogo que coincidan."
              action={{ label: "Crear Operación", onClick: openCreateOpDialog }}
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono">{op.code}</TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>{op.category || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={op.scope === "vehicle" ? "default" : "secondary"}>
                          {op.scope === "vehicle" ? "Vehículo" : "Negocio"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={op.is_active} onCheckedChange={() => toggleOpActive(op)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditOpDialog(op)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Create/Edit Operation */}
      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOp ? "Editar Operación" : "Nueva Operación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={opForm.code}
                  onChange={(e) => setOpForm({ ...opForm, code: e.target.value.toUpperCase() })}
                  placeholder="OP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Scope *</Label>
                <Select value={opForm.scope} onValueChange={(v) => setOpForm({ ...opForm, scope: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={opForm.name}
                onChange={(e) => setOpForm({ ...opForm, name: e.target.value })}
                placeholder="Cambio de aceite"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={opForm.category} onValueChange={(v) => setOpForm({ ...opForm, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={opForm.description}
                onChange={(e) => setOpForm({ ...opForm, description: e.target.value })}
                placeholder="Descripción de la operación..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOperation} disabled={opSaving}>
              {opSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Create Vehicle Work Order */}
      <Dialog open={createVwoDialogOpen} onOpenChange={setCreateVwoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Orden de Alistamiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Vehículo *</Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Buscar vehículo..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.license_plate || "Sin placa"} — {v.brand} {v.line || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateVwoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateVehicleWO} disabled={creatingVwo || !selectedVehicleId}>
              {creatingVwo ? "Creando..." : "Crear y Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Create Business Work Order */}
      <Dialog open={createBwoDialogOpen} onOpenChange={setCreateBwoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Orden de Negocio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notas / Descripción</Label>
              <Textarea
                value={bwoNotes}
                onChange={(e) => setBwoNotes(e.target.value)}
                placeholder="Ej: Mantenimiento oficina, compra insumos..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBwoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBusinessWO} disabled={creatingBwo}>
              {creatingBwo ? "Creando..." : "Crear y Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet: Work Order Management */}
      <WorkOrderSheet
        workOrderId={selectedWorkOrder?.id || null}
        vehicle={selectedWorkOrder?.vehicle}
        scope={selectedWorkOrder?.vehicle_id ? "vehicle" : "business"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRefresh={fetchData}
      />
    </AdminLayout>
  );
}
