import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

// Tab components
import { VehicleSummaryTab } from "@/components/vehicle/VehicleSummaryTab";
import { VehicleInfoTab } from "@/components/vehicle/VehicleInfoTab";
import { VehicleListingTab } from "@/components/vehicle/VehicleListingTab";
import { VehicleComplianceTab } from "@/components/vehicle/VehicleComplianceTab";
import { VehicleFinancialsTab } from "@/components/vehicle/VehicleFinancialsTab";
import { VehicleLegalTab } from "@/components/vehicle/VehicleLegalTab";
import { VehicleWorkOrdersTab } from "@/components/vehicle/VehicleWorkOrdersTab";
import { VehicleExpensesTab } from "@/components/vehicle/VehicleExpensesTab";
import { VehicleFilesTab } from "@/components/vehicle/VehicleFilesTab";
import { VehicleHistoryTab } from "@/components/vehicle/VehicleHistoryTab";
import { VehicleSalesTab } from "@/components/vehicle/VehicleSalesTab";

import { Trash2, Archive, RefreshCw } from "lucide-react";

interface Vehicle {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  vehicle_class: string | null;
  stage_code: string;
  is_archived: boolean;
  [key: string]: any;
}

interface VehicleStage {
  code: string;
  name: string;
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingStage, setChangingStage] = useState(false);

  const fetchVehicle = async () => {
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
    } catch (err: any) {
      console.error("Error fetching vehicle:", err);
      setError(err.message || "Error al cargar vehículo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicle();
  }, [id]);

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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al cambiar estado");
    } finally {
      setChangingStage(false);
    }
  };

  const handleArchive = async () => {
    if (!vehicle) return;
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ is_archived: !vehicle.is_archived })
        .eq("id", vehicle.id);
      if (error) throw error;
      setVehicle({ ...vehicle, is_archived: !vehicle.is_archived });
      toast.success(vehicle.is_archived ? "Vehículo desarchivado" : "Vehículo archivado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) throw error;
      toast.success("Vehículo eliminado");
      navigate("/admin/vehicles");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cargando..." breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Inventario", href: "/admin/vehicles" }, { label: "Detalle" }]}>
        <LoadingState variant="detail" />
      </AdminLayout>
    );
  }

  if (error || !vehicle) {
    return (
      <AdminLayout title="Error" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Inventario", href: "/admin/vehicles" }, { label: "Detalle" }]}>
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
        { label: "Dashboard", href: "/admin/dashboard" },
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
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
            <TabsList className="inline-flex h-auto gap-1 min-w-max p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Vista general</TabsTrigger>
              <TabsTrigger value="info" className="text-xs sm:text-sm px-2 sm:px-3">Info</TabsTrigger>
              <TabsTrigger value="operations" className="text-xs sm:text-sm px-2 sm:px-3">Operación</TabsTrigger>
              <TabsTrigger value="internal" className="text-xs sm:text-sm px-2 sm:px-3">Interno</TabsTrigger>
              <TabsTrigger value="sales" className="text-xs sm:text-sm px-2 sm:px-3">Ventas</TabsTrigger>
              <TabsTrigger value="files" className="text-xs sm:text-sm px-2 sm:px-3">Archivos</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3">Historial</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <VehicleSummaryTab vehicle={vehicle} />
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-4">
            <VehicleInfoTab vehicle={vehicle} onUpdate={(v) => setVehicle(v)} />
            <VehicleListingTab vehicleId={vehicle.id} />
            <VehicleComplianceTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="operations" className="mt-4">
            <VehicleWorkOrdersTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="internal" className="mt-4 space-y-4">
            <VehicleFinancialsTab vehicleId={vehicle.id} />
            <VehicleExpensesTab vehicleId={vehicle.id} />
            <VehicleLegalTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <VehicleSalesTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <VehicleFilesTab vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <VehicleHistoryTab vehicleId={vehicle.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
