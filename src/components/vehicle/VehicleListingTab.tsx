import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { logger } from "@/lib/logger";

interface Props {
  vehicleId: string;
}

export function VehicleListingTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [listing, setListing] = useState<Tables<"vehicle_listing"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    is_listed: false,
    listed_price_cop: "",
  });

  useEffect(() => {
    const fetchListing = async () => {
      const { data } = await supabase
        .from("vehicle_listing")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      
      if (data) {
        setListing(data);
        setForm({
          is_listed: data.is_listed || false,
          listed_price_cop: data.listed_price_cop?.toString() || "",
        });
      }
      setLoading(false);
    };
    fetchListing();
  }, [vehicleId]);

  const handleSave = async () => {
    if (!profile?.org_id) return;
    setSaving(true);
    try {
      const payload = {
        vehicle_id: vehicleId,
        org_id: profile.org_id,
        is_listed: form.is_listed,
        listed_price_cop: form.listed_price_cop ? parseInt(form.listed_price_cop) : null,
      };

      const { error } = await supabase
        .from("vehicle_listing")
        .upsert(payload, { onConflict: "vehicle_id" });

      if (error) throw error;
      toast.success("Información comercial actualizada");
    } catch (err: unknown) {
      logger.error(err);
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="detail" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <Switch
            id="is_listed"
            checked={form.is_listed}
            onCheckedChange={(checked) => setForm(f => ({ ...f, is_listed: checked }))}
          />
          <Label htmlFor="is_listed">Publicado para venta</Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Precio de Lista (COP)</Label>
            <Input
              type="number"
              min="0"
              value={form.listed_price_cop}
              onChange={(e) => setForm(f => ({ ...f, listed_price_cop: e.target.value }))}
              placeholder="45000000"
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
