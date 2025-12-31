import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { formatCOP } from "@/lib/format";

interface Props {
  vehicleId: string;
}

export function VehicleFinancialsTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const [form, setForm] = useState({
    purchase_price_cop: "",
    purchase_date: "",
    supplier_name: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [financialsRes, expensesRes] = await Promise.all([
        supabase.from("vehicle_financials").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
        supabase.from("vehicle_expenses").select("amount_cop").eq("vehicle_id", vehicleId),
      ]);
      
      if (financialsRes.data) {
        setForm({
          purchase_price_cop: financialsRes.data.purchase_price_cop?.toString() || "",
          purchase_date: financialsRes.data.purchase_date || "",
          supplier_name: financialsRes.data.supplier_name || "",
        });
      }
      
      setTotalExpenses((expensesRes.data || []).reduce((sum, e) => sum + (e.amount_cop || 0), 0));
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
        purchase_price_cop: form.purchase_price_cop ? parseInt(form.purchase_price_cop) : null,
        purchase_date: form.purchase_date || null,
        supplier_name: form.supplier_name || null,
      };

      const { error } = await supabase
        .from("vehicle_financials")
        .upsert(payload, { onConflict: "vehicle_id" });

      if (error) throw error;
      toast.success("Información financiera actualizada");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="detail" />;

  const purchasePrice = form.purchase_price_cop ? parseInt(form.purchase_price_cop) : 0;
  const totalCost = purchasePrice + totalExpenses;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Precio de Compra (COP)</Label>
              <Input
                type="number"
                min="0"
                value={form.purchase_price_cop}
                onChange={(e) => setForm(f => ({ ...f, purchase_price_cop: e.target.value }))}
                placeholder="35000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Compra</Label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm(f => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input
                value={form.supplier_name}
                onChange={(e) => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Nombre del proveedor"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </CardContent>
      </Card>

      {/* Resumen Financiero */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precio de Compra</span>
              <span>{formatCOP(purchasePrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Gastos</span>
              <span>{formatCOP(totalExpenses)}</span>
            </div>
            <div className="flex justify-between font-medium text-lg border-t pt-3">
              <span>Costo Total Estimado</span>
              <span>{formatCOP(totalCost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
