import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Props {
  vehicleId: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onCollectPayload?: (collector: (() => Promise<void>) | null) => void;
}

export function VehicleAcquisitionTab({ vehicleId, onDirtyChange, onCollectPayload }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialForm, setInitialForm] = useState({
    purchase_price_cop: "",
    listed_price_cop: "",
    purchase_date: "",
    supplier_name: "",
  });

  const [form, setForm] = useState({
    purchase_price_cop: "",
    listed_price_cop: "",
    purchase_date: "",
    supplier_name: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [financialsRes, listingRes] = await Promise.all([
        supabase.from("vehicle_financials").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
        supabase.from("vehicle_listing").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
      ]);

      if (financialsRes.data || listingRes.data) {
        const nextForm = {
          purchase_price_cop: financialsRes.data?.purchase_price_cop?.toString() || "",
          listed_price_cop: listingRes.data?.listed_price_cop?.toString() || "",
          purchase_date: financialsRes.data?.purchase_date || "",
          supplier_name: financialsRes.data?.supplier_name || "",
        };
        setForm(nextForm);
        setInitialForm(nextForm);
      }

      setLoading(false);
    };

    void fetchData();
  }, [vehicleId]);

  const handleSave = useCallback(async (silent = false) => {
    if (!profile?.org_id) return;
    setSaving(true);

    try {
      const financialsPayload = {
        vehicle_id: vehicleId,
        org_id: profile.org_id,
        purchase_price_cop: form.purchase_price_cop ? parseInt(form.purchase_price_cop, 10) : null,
        purchase_date: form.purchase_date || null,
        supplier_name: form.supplier_name || null,
      };

      const listingPayload = {
        vehicle_id: vehicleId,
        org_id: profile.org_id,
        listed_price_cop: form.listed_price_cop ? parseInt(form.listed_price_cop, 10) : null,
      };

      const [financialsSaveRes, listingSaveRes] = await Promise.all([
        supabase.from("vehicle_financials").upsert(financialsPayload, { onConflict: "vehicle_id" }),
        supabase.from("vehicle_listing").upsert(listingPayload, { onConflict: "vehicle_id" }),
      ]);

      if (financialsSaveRes.error) throw financialsSaveRes.error;
      if (listingSaveRes.error) throw listingSaveRes.error;

      setInitialForm(form);
      if (!silent) {
        toast.success("Adquisición actualizada");
      }
    } catch (err: unknown) {
      logger.error(err);
      if (!silent) {
        toast.error(getErrorMessage(err, "Error al guardar"));
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [form, profile?.org_id, vehicleId]);

  const isDirty =
    form.purchase_price_cop !== initialForm.purchase_price_cop ||
    form.listed_price_cop !== initialForm.listed_price_cop ||
    form.purchase_date !== initialForm.purchase_date ||
    form.supplier_name !== initialForm.supplier_name;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onCollectPayload?.(() => handleSave(true));
    return () => onCollectPayload?.(null);
  }, [handleSave, onCollectPayload]);

  if (loading) return <LoadingState variant="detail" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adquisición</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Valor de compra</Label>
            <Input
              type="number"
              min="0"
              value={form.purchase_price_cop}
              onChange={(e) => setForm((f) => ({ ...f, purchase_price_cop: e.target.value }))}
              placeholder="35000000"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor de venta objetivo (COP)</Label>
            <Input
              type="number"
              min="0"
              value={form.listed_price_cop}
              onChange={(e) => setForm((f) => ({ ...f, listed_price_cop: e.target.value }))}
              placeholder="45000000"
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de compra</Label>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Input
              value={form.supplier_name}
              onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
              placeholder="Nombre del proveedor"
            />
          </div>
        </div>

        <Button onClick={() => void handleSave()} disabled={saving || !isDirty}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
