import { useState, useEffect, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { useAudit } from "@/hooks/use-audit";

// Tab components
import { VehicleSummaryTab } from "@/components/vehicle/VehicleSummaryTab";
import { VehicleInfoTab } from "@/components/vehicle/VehicleInfoTab";
import { VehicleAcquisitionTab } from "@/components/vehicle/VehicleAcquisitionTab";
import { VehicleComplianceTab } from "@/components/vehicle/VehicleComplianceTab";
import { VehicleLegalTab } from "@/components/vehicle/VehicleLegalTab";
import { VehicleWorkOrdersTab } from "@/components/vehicle/VehicleWorkOrdersTab";
import { VehicleExpensesTab } from "@/components/vehicle/VehicleExpensesTab";
import { VehicleFilesTab } from "@/components/vehicle/VehicleFilesTab";
import { VehicleSalesTab } from "@/components/vehicle/VehicleSalesTab";

import { Trash2, Archive } from "lucide-react";

type Vehicle = Tables<"vehicles">;

interface VehicleStage {
  code: string;
  name: string;
}

type InternalSectionKey = "acquisition" | "compliance" | "files";
type SaveCollector = (() => Promise<void>) | null;
type UnifiedSaveStatus = "clean" | "dirty" | "saving" | "saved";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingStage, setChangingStage] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dirtyMap, setDirtyMap] = useState<Record<InternalSectionKey, boolean>>({
    acquisition: false,
    compliance: false,
    files: false,
  });
  const [collectors, setCollectors] = useState<Record<InternalSectionKey, SaveCollector>>({
    acquisition: null,
    compliance: null,
    files: null,
  });
  const [savingAll, setSavingAll] = useState(false);
  const [saveStatus, setSaveStatus] = useState<UnifiedSaveStatus>("clean");
  const { log: logAudit } = useAudit();

  const hasPendingChanges = Object.values(dirtyMap).some(Boolean);

  useEffect(() => {
    if (savingAll) {
      setSaveStatus("saving");
      return;
    }

    if (hasPendingChanges) {
      setSaveStatus("dirty");
      return;
    }

    setSaveStatus((current) => (current === "saved" ? "saved" : "clean"));
  }, [hasPendingChanges, savingAll]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timeout = window.setTimeout(() => setSaveStatus("clean"), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const handleSectionDirtyChange = useCallback((section: InternalSectionKey, isDirty: boolean) => {
    setDirtyMap((prev) => ({ ...prev, [section]: isDirty }));
  }, []);

  const handleCollectPayload = useCallback((section: InternalSectionKey, collector: SaveCollector) => {
    setCollectors((prev) => ({ ...prev, [section]: collector }));
  }, []);

  const saveOrder: InternalSectionKey[] = ["acquisition", "compliance", "files"];

  const handleSaveAll = async () => {
    const sectionsToSave = saveOrder.filter((section) => dirtyMap[section]);

    if (sectionsToSave.length === 0) {
      toast.info("No hay cambios pendientes");
      return;
    }

    setSavingAll(true);
    const failures: string[] = [];
    const labels: Record<InternalSectionKey, string> = {
      acquisition: "adquisición",
      compliance: "cumplimiento",
      files: "archivos",
    };

    for (const section of sectionsToSave) {
      const collector = collectors[section];
      if (!collector) {
        failures.push(`${labels[section]}: sin payload de guardado`);
        continue;
      }

      try {
        await collector();
      } catch (err: unknown) {
        failures.push(`${labels[section]}: ${getErrorMessage(err, "error al guardar")}`);
      }
    }

    setSavingAll(false);

    if (failures.length > 0) {
      toast.error(`Errores por bloque: ${failures.join(" | ")}`);
      return;
    }

    setSaveStatus("saved");
    toast.success("Todos los bloques se guardaron correctamente");
  };

  const unifiedStatusLabel: Record<UnifiedSaveStatus, string> = {
    clean: "Sin cambios",
    dirty: "Cambios pendientes",
    saving: "Guardando...",
    saved: "Guardado",
  };

  const fetchVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [vehicleRes, stagesRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("id", id).single(),
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
      ]);

      if (vehicleRes.error) throw vehicleRes.error;
      setVehicle(vehicleRes.data);
      setStages(stagesRes.data || []);
    } catch (err: unknown) {
      logger.error("Error fetching vehicle:", err);
      setError(getErrorMessage(err, "Error al cargar vehículo"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  const handleStageChange = async (newStage: string) => {
    if (!vehicle) return;
    setChangingStage(true);
    try {
      const { error } = await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicle.id,
        p_target_stage: newStage,
      });
      if (error) throw error;      
      setVehicle({ ...vehicle, stage_code: newStage });
      toast.success("Estado actualizado");
    } catch (err: unknown) {
      logger.error(err);
      toast.error(getErrorMessage(err, "Error al cambiar estado"));
    } finally {
      setChangingStage(false);
    }
  };

  const handleArchive = async () => {
    if (!vehicle) return;
    const toIsArchived = !vehicle.is_archived;

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ is_archived: toIsArchived })
        .eq("id", vehicle.id);
      if (error) throw error;

      void logAudit({
        action: "vehicle_archive_toggle",
        entity: "vehicle",
        entity_id: vehicle.id,
        payload: {
          vehicle_id: vehicle.id,
          license_plate: vehicle.license_plate,
          from_is_archived: vehicle.is_archived,
          to_is_archived: toIsArchived,
        },
      }).catch((auditErr) => {
        logger.error("[Audit] vehicle_archive_toggle failed", auditErr);
      });

      setVehicle({ ...vehicle, is_archived: toIsArchived });
      toast.success(vehicle.is_archived ? "Vehículo desarchivado" : "Vehículo archivado");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) throw error;

      void logAudit({
        action: "vehicle_delete",
        entity: "vehicle",
        entity_id: vehicle.id,
        payload: {
          vehicle_id: vehicle.id,
          license_plate: vehicle.license_plate,
          brand: vehicle.brand,
          line: vehicle.line,
          model_year: vehicle.model_year,
          stage_code: vehicle.stage_code,
          is_archived: vehicle.is_archived,
          branch_id: vehicle.branch_id,
        },
      }).catch((auditErr) => {
        logger.error("[Audit] vehicle_delete failed", auditErr);
      });

      toast.success("Vehículo eliminado");
      navigate("/admin/vehicles");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cargando..." breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Inventario", href: "/admin/vehicles" }, { label: "Detalle" }]}>
        <LoadingState variant="detail" />
      </AdminLayout>
    );
  }

  if (error || !vehicle) {
    return (
      <AdminLayout title="Error" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Inventario", href: "/admin/vehicles" }, { label: "Detalle" }]}>
        <ErrorState message={error || "Vehículo no encontrado"} onRetry={fetchVehicle} />
      </AdminLayout>
    );
  }

  const title = `${vehicle.brand} ${vehicle.line || ""} ${vehicle.model_year || ""}`.trim();
  const stageName = stages.find(s => s.code === vehicle.stage_code)?.name || vehicle.stage_code;

  return (
    <AdminLayout
      title={title}
      breadcrumbs={[
        { label: "Inicio", href: "/admin/vehicles" },
        { label: "Inventario", href: "/admin/vehicles" },
        { label: vehicle.license_plate || "Detalle" },
      ]}
      actions={
        <div className="flex items-center gap-1 sm:gap-2">
          <Select value={vehicle.stage_code} onValueChange={handleStageChange} disabled={changingStage}>
            <SelectTrigger className="w-[120px] sm:w-[140px] text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleArchive} className="hidden sm:flex">
            <Archive className="h-4 w-4 mr-1" />
            {vehicle.is_archived ? "Desarchivar" : "Archivar"}
          </Button>
          <Button variant="outline" size="icon" onClick={handleArchive} className="sm:hidden h-8 w-8">
            <Archive className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="hidden sm:flex">
                <Trash2 className="h-4 w-4 mr-1" />Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="sm:hidden h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-3 flex-wrap">
          {vehicle.license_plate && (
            <span className="text-lg font-mono bg-muted px-3 py-1 rounded">{vehicle.license_plate}</span>
          )}
          <Badge variant={vehicle.is_archived ? "secondary" : "default"}>{stageName}</Badge>
          {vehicle.vehicle_class && <Badge variant="outline">{vehicle.vehicle_class}</Badge>}
          {vehicle.is_archived && <Badge variant="destructive">Archivado</Badge>}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
            <TabsList className="inline-flex h-auto gap-1 min-w-max p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">General</TabsTrigger>
              <TabsTrigger value="info" className="text-xs sm:text-sm px-2 sm:px-3">Detalle</TabsTrigger>
              <TabsTrigger value="operations" className="text-xs sm:text-sm px-2 sm:px-3">Alistamiento</TabsTrigger>
              <TabsTrigger value="internal" className="text-xs sm:text-sm px-2 sm:px-3">Otros</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <VehicleSummaryTab vehicle={vehicle} />
            <VehicleSalesTab vehicleId={vehicle.id} vehicleStageCode={vehicle.stage_code} onRefresh={fetchVehicle} />
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-4">
            <VehicleInfoTab vehicle={vehicle} onUpdate={(v) => setVehicle(v)} onAudit={logAudit} />
            <VehicleLegalTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="operations" className="mt-4 space-y-4">
            <VehicleWorkOrdersTab vehicleId={vehicle.id} />
            <VehicleExpensesTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="internal" className="mt-4 space-y-4">
            <VehicleAcquisitionTab
              vehicleId={vehicle.id}
              onDirtyChange={(isDirty) => handleSectionDirtyChange("acquisition", isDirty)}
              onCollectPayload={(collector) => handleCollectPayload("acquisition", collector)}
            />
            <VehicleComplianceTab
              vehicleId={vehicle.id}
              onDirtyChange={(isDirty) => handleSectionDirtyChange("compliance", isDirty)}
              onCollectPayload={(collector) => handleCollectPayload("compliance", collector)}
            />
            <VehicleFilesTab
              vehicleId={vehicle.id}
              onDirtyChange={(isDirty) => handleSectionDirtyChange("files", isDirty)}
              onCollectPayload={(collector) => handleCollectPayload("files", collector)}
            />

            <div className="sticky bottom-0 z-20 rounded-lg border bg-background/95 backdrop-blur p-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Estado:</span> {unifiedStatusLabel[saveStatus]}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void handleSaveAll()}
                    disabled={savingAll || !hasPendingChanges}
                    className="w-full sm:w-auto"
                  >
                    {savingAll ? "Guardando..." : "Guardar todo"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
