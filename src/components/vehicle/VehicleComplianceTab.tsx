import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";

interface Props {
  vehicleId: string;
}

export function VehicleComplianceTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    soat_expires_at: "",
    tecnomecanica_expires_at: "",
    has_fines: false,
    fines_amount_cop: "",
    compliance_notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("vehicle_compliance")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      
      if (data) {
        setForm({
          soat_expires_at: data.soat_expires_at || "",
          tecnomecanica_expires_at: data.tecnomecanica_expires_at || "",
          has_fines: data.has_fines || false,
          fines_amount_cop: data.fines_amount_cop?.toString() || "",
          compliance_notes: data.compliance_notes || "",
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
        soat_expires_at: form.soat_expires_at || null,
        tecnomecanica_expires_at: form.tecnomecanica_expires_at || null,
        has_fines: form.has_fines,
        fines_amount_cop: form.fines_amount_cop ? parseInt(form.fines_amount_cop) : 0,
        compliance_notes: form.compliance_notes || null,
      };

      const { error } = await supabase
        .from("vehicle_compliance")
        .upsert(payload, { onConflict: "vehicle_id" });

      if (error) throw error;
      toast.success("Cumplimiento actualizado");
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
        <CardTitle>Cumplimiento y Documentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Vencimiento SOAT</Label>
            <Input
              type="date"
              value={form.soat_expires_at}
              onChange={(e) => setForm(f => ({ ...f, soat_expires_at: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Vencimiento Tecnomecánica</Label>
            <Input
              type="date"
              value={form.tecnomecanica_expires_at}
              onChange={(e) => setForm(f => ({ ...f, tecnomecanica_expires_at: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Switch
              id="has_fines"
              checked={form.has_fines}
              onCheckedChange={(checked) => setForm(f => ({ ...f, has_fines: checked }))}
            />
            <Label htmlFor="has_fines">Tiene multas pendientes</Label>
          </div>

          {form.has_fines && (
            <div className="space-y-2">
              <Label>Valor de Multas (COP)</Label>
              <Input
                type="number"
                min="0"
                value={form.fines_amount_cop}
                onChange={(e) => setForm(f => ({ ...f, fines_amount_cop: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Notas de Cumplimiento</Label>
          <Textarea
            value={form.compliance_notes}
            onChange={(e) => setForm(f => ({ ...f, compliance_notes: e.target.value }))}
            placeholder="Observaciones sobre documentos, trámites pendientes..."
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
