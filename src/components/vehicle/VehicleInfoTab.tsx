import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type VehicleForm = Tables<"vehicles"> & { [key: string]: string | number | boolean | null | undefined };

interface Props {
  vehicle: Tables<"vehicles">;
  onUpdate: (vehicle: Tables<"vehicles">) => void;
}

export function VehicleInfoTab({ vehicle, onUpdate }: Props) {
  const [form, setForm] = useState<VehicleForm>({ ...vehicle });
  const [branches, setBranches] = useState<Pick<Tables<"branches">, "id" | "name">[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id, name").eq("is_active", true).then(({ data }) => {
      setBranches(data || []);
    });
  }, []);

  useEffect(() => {
    setForm({ ...vehicle });
  }, [vehicle]);

  const handleChange = (field: string, value: VehicleForm[keyof VehicleForm]) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({
          license_plate: form.license_plate?.toUpperCase().trim() || null,
          vin: form.vin?.trim() || null,
          brand: form.brand?.trim() || "",
          line: form.line?.trim() || null,
          model_year: form.model_year ? parseInt(form.model_year) : null,
          vehicle_class: form.vehicle_class || null,
          body_type: form.body_type || null,
          fuel_type: form.fuel_type || null,
          transmission: form.transmission || null,
          engine_displacement_cc: form.engine_displacement_cc ? parseInt(form.engine_displacement_cc) : null,
          doors: form.doors ? parseInt(form.doors) : null,
          capacity_passengers: form.capacity_passengers ? parseInt(form.capacity_passengers) : null,
          color: form.color || null,
          mileage_km: form.mileage_km ? parseInt(form.mileage_km) : null,
          engine_number: form.engine_number || null,
          serial_number: form.serial_number || null,
          chassis_number: form.chassis_number || null,
          branch_id: form.branch_id || null,
        })
        .eq("id", vehicle.id);

      if (error) throw error;
      onUpdate({ ...vehicle, ...form });
      toast.success("Información actualizada");
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Vehículo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identificación */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Placa</Label>
            <Input value={form.license_plate || ""} onChange={(e) => handleChange("license_plate", e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>VIN</Label>
            <Input value={form.vin || ""} onChange={(e) => handleChange("vin", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nº Motor</Label>
            <Input value={form.engine_number || ""} onChange={(e) => handleChange("engine_number", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nº Chasis</Label>
            <Input value={form.chassis_number || ""} onChange={(e) => handleChange("chassis_number", e.target.value)} />
          </div>
        </div>

        {/* Básicos */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Marca *</Label>
            <Input value={form.brand || ""} onChange={(e) => handleChange("brand", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Línea</Label>
            <Input value={form.line || ""} onChange={(e) => handleChange("line", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Input type="number" min="1900" max="2100" value={form.model_year || ""} onChange={(e) => handleChange("model_year", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Clase</Label>
            <Select value={form.vehicle_class || ""} onValueChange={(v) => handleChange("vehicle_class", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTOMOVIL">Automóvil</SelectItem>
                <SelectItem value="CAMIONETA">Camioneta</SelectItem>
                <SelectItem value="CAMPERO">Campero</SelectItem>
                <SelectItem value="MOTOCICLETA">Motocicleta</SelectItem>
                <SelectItem value="BUS">Bus</SelectItem>
                <SelectItem value="CAMION">Camión</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Técnicos */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Combustible</Label>
            <Select value={form.fuel_type || ""} onValueChange={(v) => handleChange("fuel_type", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
            <Select value={form.transmission || ""} onValueChange={(v) => handleChange("transmission", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="AUTOMATICA">Automática</SelectItem>
                <SelectItem value="CVT">CVT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cilindraje (cc)</Label>
            <Input type="number" min="0" value={form.engine_displacement_cc || ""} onChange={(e) => handleChange("engine_displacement_cc", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Kilometraje</Label>
            <Input type="number" min="0" value={form.mileage_km || ""} onChange={(e) => handleChange("mileage_km", e.target.value)} />
          </div>
        </div>

        {/* Otros */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Puertas</Label>
            <Input type="number" min="0" max="10" value={form.doors || ""} onChange={(e) => handleChange("doors", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pasajeros</Label>
            <Input type="number" min="1" value={form.capacity_passengers || ""} onChange={(e) => handleChange("capacity_passengers", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <Input value={form.color || ""} onChange={(e) => handleChange("color", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo Carrocería</Label>
            <Input value={form.body_type || ""} onChange={(e) => handleChange("body_type", e.target.value)} />
          </div>
        </div>

        {/* Sede */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Sede</Label>
            <Select value={form.branch_id || ""} onValueChange={(v) => handleChange("branch_id", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar sede" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </CardContent>
    </Card>
  );
}
