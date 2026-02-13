import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAudit } from "@/hooks/use-audit";

interface VehicleStage {
  code: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  is_active?: boolean;
}

interface VehicleRow {
  id: string;
  brand: string;
  line: string | null;
  model_year: number | null;
  mileage_km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  color: string | null;
  stage_code: string;
  branch_id: string | null;
  is_listed: boolean;
  listed_price_cop: number | null;
}

const QUICK_EDIT_TRACKED_FIELDS = [
  "brand",
  "line",
  "model_year",
  "mileage_km",
  "fuel_type",
  "transmission",
  "color",
  "stage_code",
  "branch_id",
  "is_listed",
  "listed_price_cop",
] as const;

const toNumberOrNull = (value: string) => {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

interface VehicleQuickEditProps {
  vehicle: VehicleRow | null;
  stages: VehicleStage[];
  branches: Branch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function VehicleQuickEdit({
  vehicle,
  stages,
  branches,
  open,
  onOpenChange,
  onSave,
}: VehicleQuickEditProps) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const { log: logAudit } = useAudit();
  const [form, setForm] = useState({
    brand: "",
    line: "",
    model_year: "",
    mileage_km: "",
    fuel_type: "",
    transmission: "",
    color: "",
    stage_code: "",
    branch_id: "",
    is_listed: false,
    listed_price_cop: "",
  });

  useEffect(() => {
    if (vehicle) {
      setForm({
        brand: vehicle.brand || "",
        line: vehicle.line || "",
        model_year: vehicle.model_year?.toString() || "",
        mileage_km: vehicle.mileage_km?.toString() || "",
        fuel_type: vehicle.fuel_type || "",
        transmission: vehicle.transmission || "",
        color: vehicle.color || "",
        stage_code: vehicle.stage_code || "",
        branch_id: vehicle.branch_id || "",
        is_listed: vehicle.is_listed || false,
        listed_price_cop: vehicle.listed_price_cop?.toString() || "",
      });
    }
  }, [vehicle]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!vehicle || !profile?.org_id) return;

    const normalizedVehicle = {
      brand: form.brand.trim(),
      line: form.line.trim() || null,
      model_year: toNumberOrNull(form.model_year),
      mileage_km: toNumberOrNull(form.mileage_km),
      fuel_type: form.fuel_type || null,
      transmission: form.transmission || null,
      color: form.color || null,
      stage_code: form.stage_code,
      branch_id: form.branch_id || null,
    };

    const normalizedListing = {
      is_listed: form.is_listed,
      listed_price_cop: toNumberOrNull(form.listed_price_cop),
    };

    const beforeState = {
      brand: vehicle.brand,
      line: vehicle.line,
      model_year: vehicle.model_year,
      mileage_km: vehicle.mileage_km,
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission,
      color: vehicle.color,
      stage_code: vehicle.stage_code,
      branch_id: vehicle.branch_id,
      is_listed: vehicle.is_listed,
      listed_price_cop: vehicle.listed_price_cop,
    };

    const afterState = {
      ...normalizedVehicle,
      ...normalizedListing,
    };

    const changed_fields = QUICK_EDIT_TRACKED_FIELDS.filter(
      (field) => beforeState[field] !== afterState[field]
    );

    setSaving(true);
    try {
      // Update vehicle
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .update(normalizedVehicle)
        .eq("id", vehicle.id);

      if (vehicleError) throw vehicleError;

      // Upsert listing
      const { error: listingError } = await supabase
        .from("vehicle_listing")
        .upsert({
          vehicle_id: vehicle.id,
          org_id: profile.org_id,
          ...normalizedListing,
        });

      if (listingError) throw listingError;

      if (changed_fields.length > 0) {
        void logAudit({
          action: "vehicle_quick_edit",
          entity: "vehicle",
          entity_id: vehicle.id,
          payload: {
            vehicle_id: vehicle.id,
            changed_fields,
            before: beforeState,
            after: afterState,
          },
        }).catch((auditErr) => {
          logger.error("[Audit] vehicle_quick_edit failed", auditErr);
        });
      }

      toast.success("Vehículo actualizado");
      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      logger.error(err);
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edición Rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Marca *</Label>
              <Input
                value={form.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Línea</Label>
              <Input
                value={form.line}
                onChange={(e) => handleChange("line", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                min="1900"
                max="2100"
                value={form.model_year}
                onChange={(e) => handleChange("model_year", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kilometraje</Label>
              <Input
                type="number"
                min="0"
                value={form.mileage_km}
                onChange={(e) => handleChange("mileage_km", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Combustible</Label>
              <Select
                value={form.fuel_type}
                onValueChange={(v) => handleChange("fuel_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GASOLINA">Gasolina</SelectItem>
                  <SelectItem value="DIESEL">Diésel</SelectItem>
                  <SelectItem value="GAS">Gas</SelectItem>
                  <SelectItem value="ELECTRICO">Eléctrico</SelectItem>
                  <SelectItem value="HIBRIDO">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transmisión</Label>
              <Select
                value={form.transmission}
                onValueChange={(v) => handleChange("transmission", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="AUTOMATICA">Automática</SelectItem>
                  <SelectItem value="CVT">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sede</Label>
              <Select
                value={form.branch_id}
                onValueChange={(v) => handleChange("branch_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter(b => b.is_active !== false || b.id === form.branch_id)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.is_active === false ? " (Inactiva)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={form.stage_code}
              onValueChange={(v) => handleChange("stage_code", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Publicado</Label>
              <Switch
                checked={form.is_listed}
                onCheckedChange={(v) => handleChange("is_listed", v)}
              />
            </div>

            {form.is_listed && (
              <div className="space-y-2">
                <Label>Precio Listado (COP)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.listed_price_cop}
                  onChange={(e) =>
                    handleChange("listed_price_cop", e.target.value)
                  }
                  placeholder="50000000"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.brand.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
