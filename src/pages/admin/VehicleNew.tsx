import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VehicleStage {
  code: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
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

  const [form, setForm] = useState({
    // Identificación
    license_plate: "",
    vin: "",
    // Básicos
    brand: "",
    line: "",
    model_year: "",
    vehicle_class: "AUTOMOVIL",
    // Técnicos
    mileage_km: "",
    fuel_type: "",
    transmission: "",
    color: "",
    // Operación
    stage_code: "prospecto",
    branch_id: "",
    // Comercial
    is_listed: false,
    listed_price_cop: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [stagesRes, branchesRes] = await Promise.all([
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
        supabase.from("branches").select("id, name").eq("is_active", true),
      ]);
      if (stagesRes.data) setStages(stagesRes.data);
      if (branchesRes.data) {
        setBranches(branchesRes.data);
        if (branchesRes.data.length && !form.branch_id) {
          setForm((f) => ({ ...f, branch_id: branchesRes.data[0].id }));
        }
      }
    };
    fetchData();
  }, []);

  const handleChange = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.brand.trim()) {
      toast.error("La marca es requerida");
      return;
    }

    if (!form.vehicle_class) {
      toast.error("La clase de vehículo es requerida");
      return;
    }

    if (form.is_listed && !form.listed_price_cop) {
      toast.error("El precio es requerido si el vehículo está publicado");
      return;
    }

    if (!profile?.org_id) {
      toast.error("Error de sesión");
      return;
    }

    setLoading(true);
    try {
      // 1. Insert vehicle
      const vehicleData = {
        org_id: profile.org_id,
        branch_id: form.branch_id || null,
        license_plate: form.license_plate.toUpperCase().trim() || null,
        vin: form.vin.trim() || null,
        brand: form.brand.trim(),
        line: form.line.trim() || null,
        model_year: form.model_year ? parseInt(form.model_year) : null,
        vehicle_class: form.vehicle_class || null,
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        color: form.color || null,
        mileage_km: form.mileage_km ? parseInt(form.mileage_km) : null,
        stage_code: form.stage_code,
        is_archived: false,
      };

      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert(vehicleData)
        .select("id")
        .single();

      if (vehicleError) throw vehicleError;

      // 2. Create satellite records to prevent broken detail screens
      const vehicleId = vehicle.id;
      const orgId = profile.org_id;

      await Promise.all([
        supabase.from("vehicle_listing").upsert({
          vehicle_id: vehicleId,
          org_id: orgId,
          is_listed: form.is_listed,
          listed_price_cop: form.listed_price_cop
            ? parseInt(form.listed_price_cop)
            : null,
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
    } catch (error: any) {
      console.error("Error creating vehicle:", error);
      toast.error(error.message || "Error al crear vehículo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Crear Vehículo"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Inventario", href: "/admin/vehicles" },
        { label: "Nuevo" },
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Sección 1: Identificación */}
        <Card>
          <CardHeader>
            <CardTitle>Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license_plate">
                Placa <span className="text-muted-foreground">(recomendado)</span>
              </Label>
              <Input
                id="license_plate"
                value={form.license_plate}
                onChange={(e) =>
                  handleChange("license_plate", e.target.value.toUpperCase())
                }
                placeholder="ABC123"
                maxLength={10}
              />
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
          </CardContent>
        </Card>

        {/* Sección 2: Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Label htmlFor="line">Línea</Label>
              <Input
                id="line"
                value={form.line}
                onChange={(e) => handleChange("line", e.target.value)}
                placeholder="Corolla, CX-5..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model_year">Año Modelo</Label>
              <Input
                id="model_year"
                type="number"
                min="1900"
                max="2100"
                value={form.model_year}
                onChange={(e) => handleChange("model_year", e.target.value)}
                placeholder="2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_class">Clase *</Label>
              <Select
                value={form.vehicle_class}
                onValueChange={(v) => handleChange("vehicle_class", v)}
              >
                <SelectTrigger>
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
          </CardContent>
        </Card>

        {/* Sección 3: Técnicos */}
        <Card>
          <CardHeader>
            <CardTitle>Especificaciones Técnicas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="space-y-2">
              <Label htmlFor="fuel_type">Combustible</Label>
              <Select
                value={form.fuel_type}
                onValueChange={(v) => handleChange("fuel_type", v)}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="transmission">Transmisión</Label>
              <Select
                value={form.transmission}
                onValueChange={(v) => handleChange("transmission", v)}
              >
                <SelectTrigger>
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
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
                placeholder="Negro, Blanco..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Sección 4: Operación */}
        <Card>
          <CardHeader>
            <CardTitle>Estado y Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stage_code">Estado Inicial</Label>
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
            <div className="space-y-2">
              <Label htmlFor="branch_id">Sede</Label>
              <Select
                value={form.branch_id}
                onValueChange={(v) => handleChange("branch_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sección 5: Comercial */}
        <Card>
          <CardHeader>
            <CardTitle>Comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="is_listed">Publicar vehículo</Label>
              <Switch
                id="is_listed"
                checked={form.is_listed}
                onCheckedChange={(v) => handleChange("is_listed", v)}
              />
            </div>
            {form.is_listed && (
              <div className="space-y-2">
                <Label htmlFor="listed_price_cop">Precio Listado (COP) *</Label>
                <Input
                  id="listed_price_cop"
                  type="number"
                  min="0"
                  value={form.listed_price_cop}
                  onChange={(e) =>
                    handleChange("listed_price_cop", e.target.value)
                  }
                  placeholder="50000000"
                  required={form.is_listed}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Crear Vehículo"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/vehicles")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}
