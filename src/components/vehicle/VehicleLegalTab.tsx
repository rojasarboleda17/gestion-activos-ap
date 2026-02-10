import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";

interface Props {
  vehicleId: string;
}

export function VehicleLegalTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    property_card_number: "",
    transit_agency: "",
    registration_date: "",
    issue_date: "",
    expiry_date: "",
    owner_name: "",
    owner_identification: "",
    mobility_restriction: "",
    import_declaration: "",
    import_date: "",
    property_limitation: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("vehicle_property_card")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      
      if (data) {
        setForm({
          property_card_number: data.property_card_number || "",
          transit_agency: data.transit_agency || "",
          registration_date: data.registration_date || "",
          issue_date: data.issue_date || "",
          expiry_date: data.expiry_date || "",
          owner_name: data.owner_name || "",
          owner_identification: data.owner_identification || "",
          mobility_restriction: data.mobility_restriction || "",
          import_declaration: data.import_declaration || "",
          import_date: data.import_date || "",
          property_limitation: data.property_limitation || "",
        });
      }
      setLoading(false);
    };
    fetchData();
  }, [vehicleId]);

  const handleSave = async () => {
    if (!profile?.org_id) return;
    setSaving(true);
    try {
      const payload = {
        vehicle_id: vehicleId,
        org_id: profile.org_id,
        property_card_number: form.property_card_number || null,
        transit_agency: form.transit_agency || null,
        registration_date: form.registration_date || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        owner_name: form.owner_name || null,
        owner_identification: form.owner_identification || null,
        mobility_restriction: form.mobility_restriction || null,
        import_declaration: form.import_declaration || null,
        import_date: form.import_date || null,
        property_limitation: form.property_limitation || null,
      };

      const { error } = await supabase
        .from("vehicle_property_card")
        .upsert(payload, { onConflict: "vehicle_id" });

      if (error) throw error;
      toast.success("Tarjeta de propiedad actualizada");
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="detail" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarjeta de Propiedad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Documento */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Número de Tarjeta</Label>
            <Input
              value={form.property_card_number}
              onChange={(e) => setForm(f => ({ ...f, property_card_number: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Organismo de Tránsito</Label>
            <Input
              value={form.transit_agency}
              onChange={(e) => setForm(f => ({ ...f, transit_agency: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha Matrícula</Label>
            <Input
              type="date"
              value={form.registration_date}
              onChange={(e) => setForm(f => ({ ...f, registration_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha Expedición</Label>
            <Input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm(f => ({ ...f, issue_date: e.target.value }))}
            />
          </div>
        </div>

        {/* Propietario */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre del Propietario</Label>
            <Input
              value={form.owner_name}
              onChange={(e) => setForm(f => ({ ...f, owner_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Identificación del Propietario</Label>
            <Input
              value={form.owner_identification}
              onChange={(e) => setForm(f => ({ ...f, owner_identification: e.target.value }))}
            />
          </div>
        </div>

        {/* Restricciones */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Restricción de Movilidad</Label>
            <Textarea
              value={form.mobility_restriction}
              onChange={(e) => setForm(f => ({ ...f, mobility_restriction: e.target.value }))}
              placeholder="Prendas, embargos..."
            />
          </div>
          <div className="space-y-2">
            <Label>Limitación de Propiedad</Label>
            <Textarea
              value={form.property_limitation}
              onChange={(e) => setForm(f => ({ ...f, property_limitation: e.target.value }))}
            />
          </div>
        </div>

        {/* Importación */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Declaración de Importación</Label>
            <Input
              value={form.import_declaration}
              onChange={(e) => setForm(f => ({ ...f, import_declaration: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de Importación</Label>
            <Input
              type="date"
              value={form.import_date}
              onChange={(e) => setForm(f => ({ ...f, import_date: e.target.value }))}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
