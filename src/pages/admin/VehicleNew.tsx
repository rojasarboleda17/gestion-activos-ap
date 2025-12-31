import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

interface VehicleStage {
  code: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function VehicleNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<VehicleStage[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [form, setForm] = useState({
    license_plate: "",
    vin: "",
    brand: "",
    line: "",
    model_year: "",
    vehicle_class: "AUTOMOVIL",
    body_type: "",
    fuel_type: "",
    transmission: "",
    engine_displacement_cc: "",
    doors: "",
    capacity_passengers: "",
    color: "",
    mileage_km: "",
    stage_code: "prospecto",
    branch_id: "",
    engine_number: "",
    serial_number: "",
    chassis_number: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [stagesRes, branchesRes] = await Promise.all([
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
        supabase.from("branches").select("id, name").eq("is_active", true),
      ]);
      if (stagesRes.data) setStages(stagesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (branchesRes.data?.length && !form.branch_id) {
        setForm(f => ({ ...f, branch_id: branchesRes.data[0].id }));
      }
    };
    fetchData();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      toast.error("La marca es requerida");
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
        body_type: form.body_type || null,
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        engine_displacement_cc: form.engine_displacement_cc ? parseInt(form.engine_displacement_cc) : null,
        doors: form.doors ? parseInt(form.doors) : null,
        capacity_passengers: form.capacity_passengers ? parseInt(form.capacity_passengers) : null,
        color: form.color || null,
        mileage_km: form.mileage_km ? parseInt(form.mileage_km) : null,
        stage_code: form.stage_code,
        engine_number: form.engine_number || null,
        serial_number: form.serial_number || null,
        chassis_number: form.chassis_number || null,
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
          is_listed: false,
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
        {/* Identificación */}
        <Card>
          <CardHeader><CardTitle>Identificación</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license_plate">Placa</Label>
              <Input
                id="license_plate"
                value={form.license_plate}
                onChange={(e) => handleChange("license_plate", e.target.value.toUpperCase())}
                placeholder="ABC123"
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
            <div className="space-y-2">
              <Label htmlFor="engine_number">Número de Motor</Label>
              <Input
                id="engine_number"
                value={form.engine_number}
                onChange={(e) => handleChange("engine_number", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassis_number">Número de Chasis</Label>
              <Input
                id="chassis_number"
                value={form.chassis_number}
                onChange={(e) => handleChange("chassis_number", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Básicos */}
        <Card>
          <CardHeader><CardTitle>Información Básica</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <Label htmlFor="vehicle_class">Clase</Label>
              <Select value={form.vehicle_class} onValueChange={(v) => handleChange("vehicle_class", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="body_type">Tipo de Carrocería</Label>
              <Input
                id="body_type"
                value={form.body_type}
                onChange={(e) => handleChange("body_type", e.target.value)}
                placeholder="Sedan, SUV, Hatchback..."
              />
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

        {/* Técnicos */}
        <Card>
          <CardHeader><CardTitle>Especificaciones Técnicas</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fuel_type">Combustible</Label>
              <Select value={form.fuel_type} onValueChange={(v) => handleChange("fuel_type", v)}>
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
              <Label htmlFor="transmission">Transmisión</Label>
              <Select value={form.transmission} onValueChange={(v) => handleChange("transmission", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="AUTOMATICA">Automática</SelectItem>
                  <SelectItem value="CVT">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="engine_displacement_cc">Cilindraje (cc)</Label>
              <Input
                id="engine_displacement_cc"
                type="number"
                min="0"
                value={form.engine_displacement_cc}
                onChange={(e) => handleChange("engine_displacement_cc", e.target.value)}
                placeholder="1600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doors">Puertas</Label>
              <Input
                id="doors"
                type="number"
                min="0"
                max="10"
                value={form.doors}
                onChange={(e) => handleChange("doors", e.target.value)}
                placeholder="4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity_passengers">Pasajeros</Label>
              <Input
                id="capacity_passengers"
                type="number"
                min="1"
                max="100"
                value={form.capacity_passengers}
                onChange={(e) => handleChange("capacity_passengers", e.target.value)}
                placeholder="5"
              />
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
          </CardContent>
        </Card>

        {/* Estado y Sede */}
        <Card>
          <CardHeader><CardTitle>Estado y Ubicación</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stage_code">Estado Inicial</Label>
              <Select value={form.stage_code} onValueChange={(v) => handleChange("stage_code", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_id">Sede</Label>
              <Select value={form.branch_id} onValueChange={(v) => handleChange("branch_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sede" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Crear Vehículo"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/admin/vehicles")}>
            Cancelar
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}
