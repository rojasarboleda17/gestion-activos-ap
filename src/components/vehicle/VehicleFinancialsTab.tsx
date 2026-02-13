import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { formatCOP, formatDate } from "@/lib/format";
import { 
  TrendingUp, TrendingDown, DollarSign, Receipt, 
  Wallet, Clock, Percent, Calculator, AlertCircle
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { logger } from "@/lib/logger";

interface Props {
  vehicleId: string;
}

interface SaleData {
  id: string;
  final_price_cop: number;
  sale_date: string;
  status: string;
  customer_name: string;
}

interface PaymentData {
  id: string;
  amount_cop: number;
  direction: string;
  paid_at: string;
  payment_method_code: string;
  notes: string | null;
}

interface ReservationData {
  id: string;
  deposit_amount_cop: number;
  reserved_at: string;
  status: string;
}

interface FinancialSummary {
  // Costs
  purchasePrice: number;
  totalExpenses: number;
  totalCost: number;
  
  // Income
  salePrice: number;
  totalPaymentsIn: number;
  pendingBalance: number;
  
  // Profit metrics
  grossProfit: number;
  marginPercent: number;
  roi: number;
  
  // Time metrics
  daysInInventory: number;
  costPerDay: number;
  
  // Status
  isSold: boolean;
  hasActiveReservation: boolean;
  reservationDeposit: number;
}

interface ListingData {
  listed_price_cop: number | null;
}

export function VehicleFinancialsTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    purchase_price_cop: "",
    purchase_date: "",
    supplier_name: "",
  });
  
  const [expenses, setExpenses] = useState<{ amount_cop: number; description: string | null }[]>([]);
  const [sale, setSale] = useState<SaleData | null>(null);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [vehicleCreatedAt, setVehicleCreatedAt] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [
        financialsRes, 
        expensesRes, 
        vehicleRes,
        listingRes,
        saleRes,
        reservationRes,
      ] = await Promise.all([
        supabase.from("vehicle_financials").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
        supabase.from("vehicle_expenses").select("amount_cop, description").eq("vehicle_id", vehicleId),
        supabase.from("vehicles").select("created_at").eq("id", vehicleId).single(),
        supabase.from("vehicle_listing").select("listed_price_cop").eq("vehicle_id", vehicleId).maybeSingle(),
        supabase.from("sales")
          .select("id, final_price_cop, sale_date, status, customers(full_name)")
          .eq("vehicle_id", vehicleId)
          .in("status", ["active", "final"])
          .order("sale_date", { ascending: false }),
        supabase.from("reservations")
          .select("id, deposit_amount_cop, reserved_at, status")
          .eq("vehicle_id", vehicleId)
          .eq("status", "active")
          .maybeSingle(),
      ]);
      
      if (financialsRes.data) {
        setForm({
          purchase_price_cop: financialsRes.data.purchase_price_cop?.toString() || "",
          purchase_date: financialsRes.data.purchase_date || "",
          supplier_name: financialsRes.data.supplier_name || "",
        });
      }
      
      setExpenses(expensesRes.data || []);
      setVehicleCreatedAt(vehicleRes.data?.created_at || null);
      setListing(listingRes.data);
      
      const selectedSale = saleRes.data?.find((s) => s.status === "active")
        || saleRes.data?.find((s) => s.status === "final");

      if (selectedSale) {
        setSale({
          id: selectedSale.id,
          final_price_cop: selectedSale.final_price_cop,
          sale_date: selectedSale.sale_date,
          status: selectedSale.status,
          customer_name: ((selectedSale.customers as { full_name: string | null } | null)?.full_name) || "Cliente",
        });
        
        // Fetch payments for this sale
        const paymentsRes = await supabase
          .from("sale_payments")
          .select("id, amount_cop, direction, paid_at, payment_method_code, notes")
          .eq("sale_id", selectedSale.id)
          .order("paid_at", { ascending: true });
        
        setPayments(paymentsRes.data || []);
      } else {
        setSale(null);
        setPayments([]);
      }
      
      setReservation(reservationRes.data);
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
    } catch (err: unknown) {
      logger.error(err);
      toast.error(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="detail" />;

  // Calculate financial summary
  const purchasePrice = form.purchase_price_cop ? parseInt(form.purchase_price_cop) : 0;
  const listedPrice = listing?.listed_price_cop ?? null;
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_cop || 0), 0);
  const totalCost = purchasePrice + totalExpenses;
  
  const salePrice = sale?.final_price_cop || 0;
  const totalPaymentsIn = payments
    .filter(p => p.direction === "in")
    .reduce((sum, p) => sum + p.amount_cop, 0);
  const totalPaymentsOut = payments
    .filter(p => p.direction === "out")
    .reduce((sum, p) => sum + p.amount_cop, 0);
  const netPayments = totalPaymentsIn - totalPaymentsOut;
  const pendingBalance = salePrice - netPayments;
  
  const grossProfit = salePrice - totalCost;
  const marginPercent = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;
  const roi = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
  
  // Days in inventory
  const startDate = form.purchase_date 
    ? parseISO(form.purchase_date) 
    : vehicleCreatedAt 
      ? parseISO(vehicleCreatedAt) 
      : new Date();
  const endDate = sale?.sale_date ? parseISO(sale.sale_date) : new Date();
  const daysInInventory = differenceInDays(endDate, startDate);
  const costPerDay = daysInInventory > 0 ? totalCost / daysInInventory : 0;
  
  const isSold = !!sale;
  const hasActiveReservation = !!reservation;
  const reservationDeposit = reservation?.deposit_amount_cop || 0;

  return (
    <div className="space-y-6">
      {/* Purchase Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Información de Compra
          </CardTitle>
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

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Costo Total</p>
                <p className="text-xl font-bold">{formatCOP(totalCost)}</p>
                <p className="text-xs text-muted-foreground">Fuente: compra + gastos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2.5">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Precio objetivo</p>
                <p className="text-xl font-bold">{listedPrice !== null ? formatCOP(listedPrice) : "—"}</p>
                <p className="text-xs text-muted-foreground">Fuente: vehicle_listing.listed_price_cop</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={grossProfit >= 0 ? "" : "border-destructive/50"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${grossProfit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {grossProfit >= 0 
                  ? <TrendingUp className="h-5 w-5 text-green-600" />
                  : <TrendingDown className="h-5 w-5 text-destructive" />
                }
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Venta real</p>
                <p className={`text-xl font-bold ${isSold ? "" : "text-muted-foreground"}`}>
                  {isSold ? formatCOP(salePrice) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Fuente: sales activa/final</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <Percent className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margen / ROI</p>
                <p className="text-xl font-bold">
                  {isSold ? `${marginPercent.toFixed(1)}% / ${roi.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              Desglose de Costos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Precio de Compra</span>
                <span>{formatCOP(purchasePrice)}</span>
              </div>
              
              {expenses.length > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Gastos Operacionales</p>
                  {expenses.map((exp, i) => (
                    <div key={i} className="flex justify-between text-sm pl-4">
                      <span className="text-muted-foreground truncate max-w-[60%]">
                        {exp.description || `Gasto ${i + 1}`}
                      </span>
                      <span>{formatCOP(exp.amount_cop)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pl-4 font-medium">
                    <span>Subtotal Gastos</span>
                    <span>{formatCOP(totalExpenses)}</span>
                  </div>
                </>
              )}
              
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Costo Total</span>
                <span>{formatCOP(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Métricas de Tiempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Días en Inventario</span>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {daysInInventory} días
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Costo por Día</span>
                <span className="font-medium">{formatCOP(Math.round(costPerDay))}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fecha de Compra</span>
                <span>{form.purchase_date ? formatDate(form.purchase_date) : "No registrada"}</span>
              </div>
              
              {isSold && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Fecha de Venta</span>
                  <span>{formatDate(sale!.sale_date)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sale & Payments Section */}
      {(isSold || hasActiveReservation) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5" />
              {isSold ? "Estado de Venta y Pagos" : "Reserva Activa"}
            </CardTitle>
            <CardDescription>
              {isSold 
                ? `Venta a ${sale?.customer_name} - ${formatDate(sale!.sale_date)}`
                : `Depósito de reserva: ${formatCOP(reservationDeposit)}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSold ? (
              <div className="space-y-4">
                {/* Sale Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Precio Final</p>
                    <p className="text-xl font-bold">{formatCOP(salePrice)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10">
                    <p className="text-sm text-muted-foreground">Total Recibido</p>
                    <p className="text-xl font-bold text-green-600">{formatCOP(netPayments)}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${pendingBalance > 0 ? "bg-warning/10" : "bg-green-500/10"}`}>
                    <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                    <p className={`text-xl font-bold ${pendingBalance > 0 ? "text-warning" : "text-green-600"}`}>
                      {formatCOP(pendingBalance)}
                    </p>
                  </div>
                </div>

                {/* Payment Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progreso de Cobro</span>
                    <span>{salePrice > 0 ? Math.round((netPayments / salePrice) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, salePrice > 0 ? (netPayments / salePrice) * 100 : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Payment History */}
                {payments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium mb-3">Historial de Pagos</p>
                      <div className="space-y-2">
                        {payments.map((p) => (
                          <div 
                            key={p.id} 
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant={p.direction === "in" ? "default" : "destructive"} className="text-xs">
                                {p.direction === "in" ? "+" : "-"}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium">
                                  {p.direction === "in" ? "Ingreso" : "Devolución"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(p.paid_at)} • {p.payment_method_code}
                                </p>
                              </div>
                            </div>
                            <span className={`font-medium ${p.direction === "out" ? "text-destructive" : ""}`}>
                              {p.direction === "out" ? "-" : "+"}{formatCOP(p.amount_cop)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {pendingBalance > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">
                      Falta cobrar {formatCOP(pendingBalance)} para completar la venta
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Badge>Reserva Activa</Badge>
                <div>
                  <p className="text-sm font-medium">Depósito: {formatCOP(reservationDeposit)}</p>
                  <p className="text-xs text-muted-foreground">
                    Reservado el {formatDate(reservation!.reserved_at)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profit Analysis (only if sold) */}
      {isSold && (
        <Card className={grossProfit >= 0 ? "border-green-500/30" : "border-destructive/30"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {grossProfit >= 0 
                ? <TrendingUp className="h-5 w-5 text-green-600" />
                : <TrendingDown className="h-5 w-5 text-destructive" />
              }
              Análisis de Rentabilidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Utilidad Bruta</p>
                <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCOP(grossProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Precio venta - Costo total
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Margen de Utilidad</p>
                <p className={`text-2xl font-bold ${marginPercent >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {marginPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Utilidad / Precio venta
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROI</p>
                <p className={`text-2xl font-bold ${roi >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {roi.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Utilidad / Inversión
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Utilidad por Día</p>
                <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCOP(daysInInventory > 0 ? Math.round(grossProfit / daysInInventory) : 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysInInventory} días en inventario
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
