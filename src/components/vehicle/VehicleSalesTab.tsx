import { useState, useEffect, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Bookmark, DollarSign, Plus, X, ArrowRight, AlertTriangle, Eye } from "lucide-react";

interface Props {
  vehicleId: string;
  vehicleStageCode?: string;
  onRefresh?: () => void;
}

interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  payment_method_code: string;
  reserved_at: string;
  customer_id: string;
  customers?: { full_name: string; phone: string | null };
}

interface Sale {
  id: string;
  status: string;
  final_price_cop: number;
  sale_date: string;
  customer_id: string;
  customers?: { full_name: string; phone: string | null };
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface PaymentMethod {
  code: string;
  name: string;
}

interface VehicleStage {
  code: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  converted: "Convertida",
  cancelled: "Cancelada",
  expired: "Expirada",
  voided: "Anulada",
};

export function VehicleSalesTab({ vehicleId, vehicleStageCode, onRefresh }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [vehicleStages, setVehicleStages] = useState<VehicleStage[]>([]);

  const isSold = vehicleStageCode === "vendido";
  const hasActiveReservation = reservations.some((r) => r.status === "active");

  // Create reservation dialog
  const [createResOpen, setCreateResOpen] = useState(false);
  const [savingRes, setSavingRes] = useState(false);
  const [resForm, setResForm] = useState({
    customer_id: "",
    deposit_amount_cop: "",
    payment_method_code: "",
    notes: "",
  });

  // Quick customer
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ full_name: "", phone: "" });

  // Cancel reservation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingReservation, setCancelingReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Convert reservation to sale dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingReservation, setConvertingReservation] = useState<Reservation | null>(null);
  const [convertForm, setConvertForm] = useState({
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
    registerDepositAsPayment: true,
  });
  const [converting, setConverting] = useState(false);

  // Create sale dialog
  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [saleForm, setSaleForm] = useState({
    customer_id: "",
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
  });

  // Void sale dialog
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidForm, setVoidForm] = useState({
    void_reason: "",
    return_stage_code: "publicado",
    refund_amount: "",
    refund_method: "",
  });
  const [voiding, setVoiding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[VehicleSalesTab] Fetching data for vehicle:", vehicleId);
      const [resRes, salesRes, custRes, pmRes, stagesRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("*, customers(full_name, phone)")
          .eq("vehicle_id", vehicleId)
          .order("reserved_at", { ascending: false }),
        supabase
          .from("sales")
          .select("*, customers(full_name, phone)")
          .eq("vehicle_id", vehicleId)
          .order("sale_date", { ascending: false }),
        supabase
          .from("customers")
          .select("id, full_name, phone")
          .eq("org_id", profile?.org_id)
          .order("full_name"),
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
        supabase
          .from("vehicle_stages")
          .select("code, name")
          .eq("is_terminal", false)
          .order("sort_order"),
      ]);
      
      setReservations(resRes.data || []);
      setSales(salesRes.data || []);
      setCustomers(custRes.data || []);
      setPaymentMethods(pmRes.data || []);
      setVehicleStages(stagesRes.data || []);
    } catch (err) {
      console.error("[VehicleSalesTab] Error fetching data:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [vehicleId, profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ===== CREATE RESERVATION =====
  const openCreateReservation = () => {
    setResForm({
      customer_id: "",
      deposit_amount_cop: "",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
    });
    setCreateResOpen(true);
  };

  const handleCreateReservation = async () => {
    if (!profile?.org_id) return;

    if (!resForm.customer_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    const depositAmount = parseInt(resForm.deposit_amount_cop);
    if (!resForm.deposit_amount_cop || isNaN(depositAmount) || depositAmount <= 0) {
      toast.error("El depósito debe ser mayor a 0");
      return;
    }
    if (!resForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setSavingRes(true);
    try {
      console.log("[VehicleSalesTab] Creating reservation...");
      const { data, error } = await supabase
        .from("reservations")
        .insert({
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          customer_id: resForm.customer_id,
          deposit_amount_cop: depositAmount,
          payment_method_code: resForm.payment_method_code,
          notes: resForm.notes?.trim() || null,
          status: "active",
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) {
        console.error("[VehicleSalesTab] Reservation error:", error);
        toast.error(`Error: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return;
      }

      if (!data) {
        toast.error("Error: No se creó la reserva");
        return;
      }

      // Update vehicle stage
      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: "bloqueado",
      });      

      toast.success("Reserva creada");
      setCreateResOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      console.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setSavingRes(false);
    }
  };

  // Quick customer
  const handleQuickCustomer = async () => {
    if (!profile?.org_id || !quickCustomerForm.full_name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: profile.org_id,
          full_name: quickCustomerForm.full_name.trim(),
          phone: quickCustomerForm.phone?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }

      setCustomers((prev) => [...prev, data]);
      setResForm({ ...resForm, customer_id: data.id });
      setSaleForm({ ...saleForm, customer_id: data.id });
      setQuickCustomerOpen(false);
      setQuickCustomerForm({ full_name: "", phone: "" });
      toast.success("Cliente creado");
    } catch (err: unknown) {
      toast.error(`Error: ${getErrorMessage(err)}`);
    }
  };

  // ===== CANCEL RESERVATION =====
  const openCancelReservation = (r: Reservation) => {
    setCancelingReservation(r);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelReservation = async () => {
    if (!cancelingReservation || !profile?.id) return;

    try {
      console.log("[VehicleSalesTab] Cancelling reservation:", cancelingReservation.id);
      const { error, data } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason?.trim() || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile.id,
        })
        .eq("id", cancelingReservation.id)
        .select();

      if (error) {
        console.error("[VehicleSalesTab] Cancel error:", error);
        toast.error(`Error: ${error.message}`);
        return;
      }

      if (!data?.length) {
        toast.error("Error: No se actualizó la reserva");
        return;
      }

      // Check for other active reservations
      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("status", "active")
        .neq("id", cancelingReservation.id);

        if (!otherActive?.length) {
          await supabase.rpc("transition_vehicle_stage", {
            p_vehicle_id: vehicleId,
            p_target_stage: "publicado",
          });
        } else {
          await supabase.rpc("transition_vehicle_stage", {
            p_vehicle_id: vehicleId,
            p_target_stage: "bloqueado",
          });
        }        

      toast.success("Reserva cancelada");
      setCancelDialogOpen(false);
      setCancelingReservation(null);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      console.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    }
  };

  // ===== CONVERT RESERVATION TO SALE =====
  const openConvertDialog = (r: Reservation) => {
    setConvertingReservation(r);
    setConvertForm({
      final_price_cop: "",
      payment_method_code: r.payment_method_code || paymentMethods[0]?.code || "",
      notes: "",
      registerDepositAsPayment: true,
    });
    setConvertDialogOpen(true);
  };

  const handleConvertToSale = async () => {
    if (!profile?.org_id || !convertingReservation) return;

    const finalPrice = parseInt(convertForm.final_price_cop);
    if (!convertForm.final_price_cop || isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return;
    }
    if (!convertForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setConverting(true);
    try {
      // Step 1: Create sale
      console.log("[VehicleSalesTab] Creating sale from reservation...");
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          customer_id: convertingReservation.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: convertForm.payment_method_code,
          reservation_id: convertingReservation.id,
          status: "active",
          created_by: profile.id,
          notes: convertForm.notes?.trim() || null,
        })
        .select()
        .single();

      if (saleError) {
        console.error("[VehicleSalesTab] Sale error:", saleError);
        toast.error(`Error al crear venta: ${saleError.message}`);
        return;
      }

      if (!saleData?.id) {
        toast.error("Error: No se creó la venta");
        return;
      }

      // Step 2: Register deposit as payment
      if (convertForm.registerDepositAsPayment) {
        const { error: paymentError } = await supabase.from("sale_payments").insert({
          org_id: profile.org_id,
          sale_id: saleData.id,
          amount_cop: convertingReservation.deposit_amount_cop,
          direction: "in",
          payment_method_code: convertingReservation.payment_method_code,
          notes: "Depósito de reserva",
          created_by: profile.id,
        });

        if (paymentError) {
          console.error("[VehicleSalesTab] Payment error:", paymentError);
          toast.warning(`Venta creada, pero falló el pago: ${paymentError.message}`);
        }
      }

      // Step 3: Update vehicle
      await supabase.rpc("mark_vehicle_sold", {
        p_vehicle_id: vehicleId,
        p_sale_id: saleData.id,
      });      

      // Step 4: Update reservation
      await supabase.from("reservations").update({ status: "converted" }).eq("id", convertingReservation.id);

      toast.success("Venta registrada exitosamente");
      setConvertDialogOpen(false);
      setConvertingReservation(null);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      console.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setConverting(false);
    }
  };

  // ===== CREATE DIRECT SALE =====
  const openCreateSale = () => {
    setSaleForm({
      customer_id: "",
      final_price_cop: "",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
    });
    setCreateSaleOpen(true);
  };

  const handleCreateSale = async () => {
    if (!profile?.org_id) return;

    if (!saleForm.customer_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    const finalPrice = parseInt(saleForm.final_price_cop);
    if (!saleForm.final_price_cop || isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return;
    }
    if (!saleForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setSavingSale(true);
    try {
      console.log("[VehicleSalesTab] Creating direct sale...");
      const { data, error } = await supabase
        .from("sales")
        .insert({
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          customer_id: saleForm.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: saleForm.payment_method_code,
          status: "active",
          created_by: profile.id,
          notes: saleForm.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error("[VehicleSalesTab] Sale error:", error);
        toast.error(`Error: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return;
      }

      if (!data) {
        toast.error("Error: No se creó la venta");
        return;
      }

      await supabase.rpc("mark_vehicle_sold", {
        p_vehicle_id: vehicleId,
        p_sale_id: data.id,
      });      

      toast.success("Venta registrada");
      setCreateSaleOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      console.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setSavingSale(false);
    }
  };

  // ===== VOID SALE =====
  const openVoidDialog = (s: Sale) => {
    setVoidingSale(s);
    setVoidForm({
      void_reason: "",
      return_stage_code: "publicado",
      refund_amount: "",
      refund_method: paymentMethods[0]?.code || "",
    });
    setVoidDialogOpen(true);
  };

  const handleVoidSale = async () => {
    if (!voidingSale || !profile?.org_id) return;
    if (!voidForm.void_reason.trim()) {
      toast.error("El motivo es requerido");
      return;
    }

    setVoiding(true);
    try {
      console.log("[VehicleSalesTab] Voiding sale:", voidingSale.id);
      const { error, data } = await supabase
        .from("sales")
        .update({
          status: "voided",
          void_reason: voidForm.void_reason.trim(),
          voided_at: new Date().toISOString(),
          voided_by: profile.id,
          return_stage_code: voidForm.return_stage_code,
        })
        .eq("id", voidingSale.id)
        .select();

      if (error) {
        console.error("[VehicleSalesTab] Void error:", error);
        toast.error(`Error: ${error.message}`);
        return;
      }

      if (!data?.length) {
        toast.error("Error: No se anuló la venta");
        return;
      }

      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: voidForm.return_stage_code,
      });      

      const refundAmount = parseInt(voidForm.refund_amount);
      if (voidForm.refund_amount && !isNaN(refundAmount) && refundAmount > 0) {
        await supabase.from("sale_payments").insert({
          org_id: profile.org_id,
          sale_id: voidingSale.id,
          amount_cop: refundAmount,
          direction: "out",
          payment_method_code: voidForm.refund_method,
          notes: "Reembolso por anulación",
          created_by: profile.id,
        });
      }

      toast.success("Venta anulada");
      setVoidDialogOpen(false);
      setVoidingSale(null);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      console.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {isSold && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            Este vehículo ha sido vendido. No se pueden crear nuevas reservas o ventas.
          </p>
        </div>
      )}

      {!isSold && hasActiveReservation && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Vehículo bloqueado por reserva activa. Convierte o cancela la reserva para liberar.
          </p>
        </div>
      )}

      {/* CTAs */}
      {!isSold && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={openCreateReservation}
            disabled={hasActiveReservation}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Reserva
          </Button>
          <Button onClick={openCreateSale} disabled={hasActiveReservation}>
            <DollarSign className="h-4 w-4 mr-2" />
            Registrar Venta
          </Button>
        </div>
      )}

      {/* Reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Reservas ({reservations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reservas</p>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{r.customers?.full_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.reserved_at)} · {r.customers?.phone || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Badge variant={r.status === "active" ? "default" : r.status === "converted" ? "secondary" : "destructive"}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                      <p className="text-sm">{formatCOP(r.deposit_amount_cop)}</p>
                    </div>
                    {r.status === "active" && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openConvertDialog(r)}
                          title="Convertir a venta"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => openCancelReservation(r)}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ventas ({sales.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ventas</p>
          ) : (
            <div className="space-y-3">
              {sales.map((s) => (
                <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{s.customers?.full_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.sale_date)} · {s.customers?.phone || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Badge variant={s.status === "active" ? "default" : "destructive"}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                      <p className="text-sm font-medium">{formatCOP(s.final_price_cop)}</p>
                    </div>
                    {s.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => openVoidDialog(s)}
                        title="Anular"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE RESERVATION DIALOG */}
      <Dialog open={createResOpen} onOpenChange={setCreateResOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Cliente *</Label>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setQuickCustomerOpen(true)}>
                  + Crear rápido
                </Button>
              </div>
              <Select value={resForm.customer_id} onValueChange={(v) => setResForm({ ...resForm, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depósito (COP) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={resForm.deposit_amount_cop}
                  onChange={(e) => setResForm({ ...resForm, deposit_amount_cop: e.target.value })}
                  placeholder="1000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Método *</Label>
                <Select value={resForm.payment_method_code} onValueChange={(v) => setResForm({ ...resForm, payment_method_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={resForm.notes}
                onChange={(e) => setResForm({ ...resForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateResOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateReservation} disabled={savingRes}>
              {savingRes ? "Guardando..." : "Crear Reserva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK CUSTOMER DIALOG */}
      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Cliente Rápido</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={quickCustomerForm.full_name}
                onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={quickCustomerForm.phone}
                onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCustomerOpen(false)}>Cancelar</Button>
            <Button onClick={handleQuickCustomer}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CANCEL RESERVATION DIALOG */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la reserva y liberará el vehículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo (opcional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelReservation}>Cancelar Reserva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONVERT TO SALE DIALOG */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir Reserva a Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {convertingReservation && (
              <div className="bg-muted p-3 rounded text-sm">
                <p><strong>Cliente:</strong> {convertingReservation.customers?.full_name}</p>
                <p><strong>Depósito:</strong> {formatCOP(convertingReservation.deposit_amount_cop)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Precio Final (COP) *</Label>
              <Input
                type="number"
                min="1"
                value={convertForm.final_price_cop}
                onChange={(e) => setConvertForm({ ...convertForm, final_price_cop: e.target.value })}
                placeholder="35000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select
                value={convertForm.payment_method_code}
                onValueChange={(v) => setConvertForm({ ...convertForm, payment_method_code: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="registerDeposit"
                checked={convertForm.registerDepositAsPayment}
                onCheckedChange={(checked) => setConvertForm({ ...convertForm, registerDepositAsPayment: checked === true })}
              />
              <label htmlFor="registerDeposit" className="text-sm">
                Registrar depósito como pago
              </label>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={convertForm.notes}
                onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConvertToSale} disabled={converting}>
              {converting ? "Procesando..." : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE SALE DIALOG */}
      <Dialog open={createSaleOpen} onOpenChange={setCreateSaleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Cliente *</Label>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setQuickCustomerOpen(true)}>
                  + Crear rápido
                </Button>
              </div>
              <Select value={saleForm.customer_id} onValueChange={(v) => setSaleForm({ ...saleForm, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio Final (COP) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={saleForm.final_price_cop}
                  onChange={(e) => setSaleForm({ ...saleForm, final_price_cop: e.target.value })}
                  placeholder="35000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Método *</Label>
                <Select value={saleForm.payment_method_code} onValueChange={(v) => setSaleForm({ ...saleForm, payment_method_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={saleForm.notes}
                onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSaleOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSale} disabled={savingSale}>
              {savingSale ? "Guardando..." : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VOID SALE DIALOG */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará la venta y cambiará el estado del vehículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={voidForm.void_reason}
                onChange={(e) => setVoidForm({ ...voidForm, void_reason: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Devolver a estado</Label>
              <Select value={voidForm.return_stage_code} onValueChange={(v) => setVoidForm({ ...voidForm, return_stage_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vehicleStages.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reembolso (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={voidForm.refund_amount}
                  onChange={(e) => setVoidForm({ ...voidForm, refund_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={voidForm.refund_method} onValueChange={(v) => setVoidForm({ ...voidForm, refund_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidSale} disabled={voiding}>
              {voiding ? "Procesando..." : "Anular Venta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
