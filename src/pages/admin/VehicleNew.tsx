import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { ChevronDown, ChevronUp } from "lucide-react";

interface VehicleStage {
  code: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

const VEHICLE_CLASSES = [
  { value: "AUTOMOVIL", label: "Automóvil" },
  { value: "CAMIONETA", label: "Camioneta" },
  { value: "CAMPERO", label: "Campero" },
  { value: "MOTOCICLETA", label: "Motocicleta" },
  { value: "BUS", label: "Bus" },
  { value: "CAMION", label: "Camión" },
];

const FUEL_TYPES = [
  { value: "GASOLINA", label: "Gasolina" },
  { value: "DIESEL", label: "Diésel" },
  { value: "GAS", label: "Gas" },
  { value: "ELECTRICO", label: "Eléctrico" },
  { value: "HIBRIDO", label: "Híbrido" },
];

const TRANSMISSIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTOMATICA", label: "Automática" },
  { value: "CVT", label: "CVT" },
];

export default function VehicleNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [form, setForm] = useState({
    license_plate: "",
    branch_id: "",
    brand: "",
    line: "",
    model_year: "",
    stage_code: "prospecto",
    vehicle_class: "AUTOMOVIL",
    vin: "",
    mileage_km: "",
    fuel_type: "",
    transmission: "",
    color: "",
    is_listed: false,
    listed_price_cop: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [stagesRes, branchesRes] = await Promise.all([
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
        supabase.from("branches").select("id, name, is_active").order("name"),
      ]);

      if (stagesRes.data) setStages(stagesRes.data);

      if (branchesRes.data) {
        setBranches(branchesRes.data);
        const activeBranches = branchesRes.data.filter((b) => b.is_active);
        if (activeBranches.length) {
          setForm((f) => (f.branch_id ? f : { ...f, branch_id: activeBranches[0].id }));
        }
      }
    };

    fetchData();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.license_plate.trim()) {
      toast.error("La placa es requerida");
      return;
    }

    if (!form.brand.trim()) {
      toast.error("La marca es requerida");
      return;
    }

    if (!form.line.trim()) {
      toast.error("La línea es requerida");
      return;
    }

    if (!form.model_year) {
      toast.error("El modelo es requerido");
      return;
    }

    const listedPrice = form.listed_price_cop
      ? parseInt(form.listed_price_cop, 10)
      : null;

    if (form.is_listed && (!listedPrice || listedPrice <= 0)) {
      toast.error("Si el vehículo está publicado, el precio debe ser mayor a 0");
      return;
    }

    if (!profile?.org_id) {
      toast.error("Error de sesión");
      return;
    }

    setLoading(true);
    try {
      const vehicleData = {
        org_id: profile.org_id,
        branch_id: form.branch_id || null,
        license_plate: form.license_plate.toUpperCase().trim(),
        vin: form.vin.trim() || null,
        brand: form.brand.trim(),
        line: form.line.trim(),
        model_year: parseInt(form.model_year, 10),
        vehicle_class: form.vehicle_class || null,
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        color: form.color || null,
        mileage_km: form.mileage_km ? parseInt(form.mileage_km, 10) : null,
        stage_code: form.stage_code,
        is_archived: false,
      };

      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert(vehicleData)
        .select("id")
        .single();

      if (vehicleError) throw vehicleError;

      const vehicleId = vehicle.id;
      const orgId = profile.org_id;

      await Promise.all([
        supabase.from("vehicle_listing").upsert({
          vehicle_id: vehicleId,
          org_id: orgId,
          is_listed: form.is_listed,
          listed_price_cop: listedPrice,
        }),
        supabase.from("vehicle_compliance").upsert({
          vehicle_id: vehicleId,
          org_id: orgId,
        }),
        supabase.from("vehicle_financials").upsert({
          vehicle_id: vehicleId,
          org_id: orgId,
        }),
        supabase.from("vehicle_property_card").upsert({
          vehicle_id: vehicleId,
          org_id: orgId,
        }),
      ]);

      toast.success("Vehículo creado exitosamente");
      navigate(`/admin/vehicles/${vehicleId}`);
    } catch (error: unknown) {
      logger.error("Error creating vehicle:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear vehículo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Crear Vehículo"
      breadcrumbs={[
        { label: "Inicio", href: "/admin/vehicles" },
        { label: "Inventario", href: "/admin/vehicles" },
        { label: "Nuevo" },
      ]}
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Registro básico del vehículo</CardTitle>
            <CardDescription>
              Completa lo mínimo para crear el vehículo. El resto lo puedes agregar después en el detalle.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="license_plate">Placa *</Label>
                <Input
                  id="license_plate"
                  required
                  value={form.license_plate}
                  onChange={(e) => handleChange("license_plate", e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">Sede</Label>
                <Select value={form.branch_id} onValueChange={(v) => handleChange("branch_id", v)}>
                  <SelectTrigger id="branch_id">
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((b) => b.is_active)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca *</Label>
                <Input
                  id="brand"
                  required
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  placeholder="Toyota, Mazda..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="line">Línea *</Label>
                <Input
                  id="line"
                  required
                  value={form.line}
                  onChange={(e) => handleChange("line", e.target.value)}
                  placeholder="Corolla, CX-5..."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model_year">Modelo (año) *</Label>
                <Input
                  id="model_year"
                  required
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.model_year}
                  onChange={(e) => handleChange("model_year", e.target.value)}
                  placeholder="2024"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stage_code">Estado inicial *</Label>
                <Select value={form.stage_code} onValueChange={(v) => handleChange("stage_code", v)}>
                  <SelectTrigger id="stage_code">
                    <SelectValue placeholder="Seleccionar estado" />
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
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                >
                  <span>Características específicas del vehículo (opcional)</span>
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="border-t px-4 py-4">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <Input
                        id="color"
                        value={form.color}
                        onChange={(e) => handleChange("color", e.target.value)}
                        placeholder="Negro, Blanco..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel_type">Combustible</Label>
                      <Select value={form.fuel_type} onValueChange={(v) => handleChange("fuel_type", v)}>
                        <SelectTrigger id="fuel_type">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {FUEL_TYPES.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="transmission">Transmisión</Label>
                      <Select value={form.transmission} onValueChange={(v) => handleChange("transmission", v)}>
                        <SelectTrigger id="transmission">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSMISSIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mileage_km">Kilometraje</Label>
                      <Input
                        id="mileage_km"
                        type="number"
                        min="0"
                        value={form.mileage_km}
                        onChange={(e) => handleChange("mileage_km", e.target.value)}
                        placeholder="50000"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_class">Clase</Label>
                      <Select value={form.vehicle_class} onValueChange={(v) => handleChange("vehicle_class", v)}>
                        <SelectTrigger id="vehicle_class">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLE_CLASSES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vin">VIN</Label>
                      <Input
                        id="vin"
                        value={form.vin}
                        onChange={(e) => handleChange("vin", e.target.value)}
                        placeholder="Número VIN"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Crear Vehículo"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/vehicles")}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </AdminLayout>
  );
}
