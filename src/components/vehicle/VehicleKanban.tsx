import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCOP, formatKm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useAudit } from "@/hooks/use-audit";
interface VehicleStage {
  code: string;
  name: string;
  sort_order: number;
}

interface VehicleRow {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  vehicle_class: string | null;
  stage_code: string;
  mileage_km: number | null;
  is_archived: boolean;
  branch_name: string | null;
  listed_price_cop: number | null;
  is_listed: boolean;
}

interface VehicleKanbanProps {
  vehicles: VehicleRow[];
  stages: VehicleStage[];
  onRefresh: () => void;
  onVehicleClick: (id: string) => void;
}

export function VehicleKanban({
  vehicles,
  stages,
  onRefresh,
  onVehicleClick,
}: VehicleKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const { log: auditLog } = useAudit();
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const getVehiclesForStage = (stageCode: string) =>
    vehicles.filter((v) => v.stage_code === stageCode);

  const handleDragStart = (e: React.DragEvent, vehicleId: string) => {
    e.dataTransfer.setData("vehicleId", vehicleId);
    setDraggingId(vehicleId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStageCode: string) => {
    e.preventDefault();
    const vehicleId = e.dataTransfer.getData("vehicleId");
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (!vehicle || vehicle.stage_code === newStageCode) {
      setDraggingId(null);
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: newStageCode,
      });

      if (error) throw error;
      
      // Audit log
      auditLog({
        action: "stage_change",
        entity: "vehicle",
        entity_id: vehicleId,
        payload: {
          from_stage: vehicle.stage_code,
          to_stage: newStageCode,
          license_plate: vehicle.license_plate,
        },
      });
      
      toast.success("Estado actualizado");
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al cambiar estado"));
    } finally {
      setUpdating(false);
      setDraggingId(null);
    }
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className={cn(
          "flex gap-4 min-w-max",
          updating && "opacity-70 pointer-events-none"
        )}
      >
        {sortedStages.map((stage) => {
          const stageVehicles = getVehiclesForStage(stage.code);
          return (
            <div
              key={stage.code}
              className="flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.code)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{stage.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stageVehicles.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {stageVehicles.map((vehicle) => (
                  <Card
                    key={vehicle.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, vehicle.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing transition-all",
                      draggingId === vehicle.id && "opacity-50 scale-95",
                      vehicle.is_archived && "opacity-60"
                    )}
                    onClick={() => onVehicleClick(vehicle.id)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {vehicle.license_plate && (
                            <span className="font-mono text-sm bg-secondary px-2 py-0.5 rounded">
                              {vehicle.license_plate}
                            </span>
                          )}
                          <p className="font-medium text-sm mt-1 truncate">
                            {vehicle.brand} {vehicle.line || ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.model_year || "—"} · {vehicle.vehicle_class || "—"}
                          </p>
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatKm(vehicle.mileage_km)}</span>
                        {vehicle.is_listed && vehicle.listed_price_cop && (
                          <span className="font-medium text-foreground">
                            {formatCOP(vehicle.listed_price_cop)}
                          </span>
                        )}
                      </div>

                      {vehicle.branch_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          📍 {vehicle.branch_name}
                        </p>
                      )}

                      {vehicle.is_archived && (
                        <Badge variant="destructive" className="text-xs">
                          Archivado
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {stageVehicles.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                    Sin vehículos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
