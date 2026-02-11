import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { CreditCard, Plus, Search } from "lucide-react";
import { logger } from "@/lib/logger";

interface SalePayment {
  id: string;
  sale_id: string;
  amount_cop: number;
  direction: string;
  payment_method_code: string;
  notes: string | null;
  paid_at: string;
  sale?: {
    vehicle?: { license_plate: string | null; brand: string };
    customer?: { full_name: string };
  };
}

interface Sale {
  id: string;
  vehicle?: { license_plate: string | null; brand: string };
  customer?: { full_name: string };
}

interface PaymentMethod {
  code: string;
  name: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function PaymentsTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Filters
  const [directionFilter, setDirectionFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sale_id: "",
    amount_cop: "",
    direction: "in",
    payment_method_code: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [paymentsRes, salesRes, pmRes] = await Promise.all([
        supabase
          .from("sale_payments")
          .select(`
            *,
            sale:sales(
              vehicle:vehicles!sales_vehicle_id_fkey(license_plate, brand),
              customer:customers(full_name)
            )
          `)
          .eq("org_id", profile.org_id)
          .order("paid_at", { ascending: false }),
        supabase
          .from("sales")
          .select(`
            id,
            vehicle:vehicles!sales_vehicle_id_fkey(license_plate, brand),
            customer:customers(full_name)
          `)
          .eq("org_id", profile.org_id)
          .eq("status", "active")
          .order("sale_date", { ascending: false }),
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
      ]);

      setPayments(
        (paymentsRes.data || []).map((p) => ({
          ...p,
          sale: p.sale,
        }))
      );
      setSales(
        (salesRes.data || []).map((s) => ({
          ...s,
          vehicle: s.vehicle,
          customer: s.customer,
        }))
      );
      setPaymentMethods(pmRes.data || []);
    } catch (err) {
      logger.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setForm({
      sale_id: "",
      amount_cop: "",
      direction: "in",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
    });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!profile?.org_id) return;

    if (!form.sale_id) {
      toast.error("Selecciona una venta");
      return;
    }
    if (!form.amount_cop || parseInt(form.amount_cop) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!form.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("sale_payments").insert({
        org_id: profile.org_id,
        sale_id: form.sale_id,
        amount_cop: parseInt(form.amount_cop),
        direction: form.direction,
        payment_method_code: form.payment_method_code,
        notes: form.notes || null,
        created_by: profile.id,
      });

      if (error) throw error;

      toast.success("Pago registrado");
      setCreateDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Error al registrar pago"));
    } finally {
      setSaving(false);
    }
  };

  // Filter
  const filtered = payments.filter((p) => {
    if (directionFilter !== "all" && p.direction !== directionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const plate = p.sale?.vehicle?.license_plate?.toLowerCase() || "";
      const customer = p.sale?.customer?.full_name?.toLowerCase() || "";
      if (!plate.includes(q) && !customer.includes(q)) return false;
    }
    return true;
  });

  // Totals
  const totalIn = filtered.filter((p) => p.direction === "in").reduce((sum, p) => sum + p.amount_cop, 0);
  const totalOut = filtered.filter((p) => p.direction === "out").reduce((sum, p) => sum + p.amount_cop, 0);

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total Ingresos</p>
            <p className="text-xl font-bold text-green-600">{formatCOP(totalIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total Egresos</p>
            <p className="text-xl font-bold text-destructive">{formatCOP(totalOut)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Neto</p>
            <p className="text-xl font-bold">{formatCOP(totalIn - totalOut)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Dirección" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="in">Ingresos</SelectItem>
            <SelectItem value="out">Egresos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pago
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin pagos"
          description="No hay pagos que coincidan con los filtros."
          action={{ label: "Registrar Pago", onClick: openCreate }}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(p.paid_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">
                          {p.sale?.vehicle?.license_plate || "S/P"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.sale?.customer?.full_name || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.direction === "in" ? "default" : "destructive"}>
                        {p.direction === "in" ? "Ingreso" : "Egreso"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`font-medium ${p.direction === "out" ? "text-destructive" : ""}`}>
                      {p.direction === "out" ? "-" : "+"}{formatCOP(p.amount_cop)}
                    </TableCell>
                    <TableCell>
                      {paymentMethods.find((pm) => pm.code === p.payment_method_code)?.name || p.payment_method_code}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {p.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono text-sm">
                        {p.sale?.vehicle?.license_plate || "S/P"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.sale?.customer?.full_name || "—"}
                      </p>
                    </div>
                    <Badge variant={p.direction === "in" ? "default" : "destructive"}>
                      {p.direction === "in" ? "Ingreso" : "Egreso"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{formatDate(p.paid_at)}</span>
                    <span className={`font-medium ${p.direction === "out" ? "text-destructive" : ""}`}>
                      {p.direction === "out" ? "-" : "+"}{formatCOP(p.amount_cop)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Venta *</Label>
              <Select
                value={form.sale_id}
                onValueChange={(v) => setForm({ ...form, sale_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar venta" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.vehicle?.license_plate || "S/P"} - {s.customer?.full_name || "Cliente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dirección *</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => setForm({ ...form, direction: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Ingreso</SelectItem>
                    <SelectItem value="out">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto (COP) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.amount_cop}
                  onChange={(e) => setForm({ ...form, amount_cop: e.target.value })}
                  placeholder="1000000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select
                value={form.payment_method_code}
                onValueChange={(v) => setForm({ ...form, payment_method_code: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Guardando..." : "Registrar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
