import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Plus, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  vehicleId: string;
}

export function VehicleExpensesTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    amount_cop: "",
    incurred_at: new Date().toISOString().split("T")[0],
    description: "",
  });

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicle_expenses")
      .select("*, profiles:created_by(full_name)")
      .eq("vehicle_id", vehicleId)
      .order("incurred_at", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [vehicleId]);

  const handleSubmit = async () => {
    if (!profile?.org_id || !form.amount_cop) {
      toast.error("El monto es requerido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vehicle_expenses").insert({
        org_id: profile.org_id,
        vehicle_id: vehicleId,
        amount_cop: parseInt(form.amount_cop),
        incurred_at: form.incurred_at || null,
        description: form.description || null,
        created_by: profile.id,
      });
      if (error) throw error;
      toast.success("Gasto registrado");
      setForm({ amount_cop: "", incurred_at: new Date().toISOString().split("T")[0], description: "" });
      setDialogOpen(false);
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_cop || 0), 0);

  return (
    <div className="space-y-6">
      {/* Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCOP(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">{expenses.length} registros</p>
        </CardContent>
      </Card>

      {/* Add Button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Registrar Gasto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Gasto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Monto (COP) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.amount_cop}
                  onChange={(e) => setForm((f) => ({ ...f, amount_cop: e.target.value }))}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.incurred_at}
                  onChange={(e) => setForm((f) => ({ ...f, incurred_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Detalle del gasto..."
                />
              </div>
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Sin gastos registrados"
          description="Registra los gastos asociados a este vehículo."
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{formatCOP(exp.amount_cop)}</p>
                  <p className="text-sm text-muted-foreground">{exp.description || "Sin descripción"}</p>
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <p>{exp.incurred_at ? formatDate(exp.incurred_at) : "—"}</p>
                  <p>{exp.profiles?.full_name || "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
