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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { ShoppingCart, Search, Eye, XCircle, DollarSign, CreditCard, Plus } from "lucide-react";

interface Sale {
  id: string;
  status: string;
  final_price_cop: number;
  payment_method_code: string;
  sale_date: string;
  notes: string | null;
  void_reason: string | null;
  return_stage_code: string | null;
  customer_id: string;
  vehicle_id: string;
  reservation_id: string | null;
  vehicle_snapshot: any;
  customer?: { full_name: string; phone: string | null };
  vehicle?: { license_plate: string | null; brand: string; line: string | null; model_year: number | null };
}

interface SalePayment {
  id: string;
  amount_cop: number;
  direction: string;
  payment_method_code: string;
  notes: string | null;
  paid_at: string;
}

interface PaymentMethod {
  code: string;
  name: string;
}

interface VehicleStage {
  code: string;
  name: string;
}

interface Vehicle {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  stage_code: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Props {
  onRefresh?: () => void;
  preselectedVehicleId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  voided: "Anulada",
};

export function SalesTab({ onRefresh, preselectedVehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [vehicleStages, setVehicleStages] = useState<VehicleStage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create sale dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    vehicle_id: preselectedVehicleId || "",
    customer_id: "",
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
  });

  // Void dialog
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidForm, setVoidForm] = useState({
    void_reason: "",
    return_stage_code: "publicado",
    refund_amount: "",
    refund_method: "",
  });
  const [voiding, setVoiding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      console.log("[Sales] Fetching data...");
      const [salesRes, pmRes, stagesRes, vehiclesRes, customersRes] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .eq("org_id", profile.org_id)
          .order("sale_date", { ascending: false }),
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
        supabase
          .from("vehicle_stages")
          .select("code, name")
          .eq("is_terminal", false)
          .order("sort_order"),
        supabase
          .from("vehicles")
          .select("id, license_plate, brand, line, model_year, stage_code")
          .eq("org_id", profile.org_id)
          .eq("is_archived", false)
          .in("stage_code", ["publicado", "bloqueado"])
          .order("brand"),
        supabase
          .from("customers")
          .select("id, full_name, phone")
          .eq("org_id", profile.org_id)
          .order("full_name"),
      ]);

      if (salesRes.error) {
        console.error("[Sales] Error fetching sales:", salesRes.error);
        toast.error(`Error al cargar ventas: ${salesRes.error.message}`);
      }

      const customerMap = new Map((customersRes.data || []).map((c: any) => [c.id, c]));
      const vehicleMap = new Map((vehiclesRes.data || []).map((v: any) => [v.id, v]));

      setSales(
        (salesRes.data || []).map((sale) => ({
          ...sale,
          customer: customerMap.get(sale.customer_id)
            ? {
                full_name: customerMap.get(sale.customer_id)?.full_name || "",
                phone: customerMap.get(sale.customer_id)?.phone || null,
              }
            : undefined,
          vehicle: vehicleMap.get(sale.vehicle_id)
            ? {
                license_plate: vehicleMap.get(sale.vehicle_id)?.license_plate || null,
                brand: vehicleMap.get(sale.vehicle_id)?.brand || "",
                line: vehicleMap.get(sale.vehicle_id)?.line || null,
                model_year: vehicleMap.get(sale.vehicle_id)?.model_year || null,
              }
            : undefined,
        }))
      );
      setPaymentMethods((pmRes.data || []) as PaymentMethod[]);
      setVehicleStages((stagesRes.data || []) as VehicleStage[]);
      setVehicles((vehiclesRes.data || []) as Vehicle[]);
      setCustomers((customersRes.data || []) as Customer[]);
      console.log("[Sales] Data loaded successfully");
    } catch (err) {
      console.error("[Sales] Unexpected error:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = async (sale: Sale) => {
    setSelectedSale(sale);
    setDetailOpen(true);
    setLoadingDetail(true);

    try {
      console.log("[Sales] Fetching payments for sale:", sale.id);
      const { data, error } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", sale.id)
        .order("paid_at", { ascending: false });

      if (error) {
        console.error("[Sales] Error fetching payments:", error);
        toast.error(`Error al cargar pagos: ${error.message}`);
      }

      setSalePayments(data || []);
    } catch (err) {
      console.error("[Sales] Unexpected error fetching payments:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Create sale
  const openCreate = () => {
    setCreateForm({
      vehicle_id: preselectedVehicleId || "",
      customer_id: "",
      final_price_cop: "",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
    });
    setCreateDialogOpen(true);
  };

  const handleCreateSale = async () => {
    if (!profile?.org_id) return;

    // Validations
    if (!createForm.vehicle_id) {
      toast.error("Selecciona un vehículo");
      return;
    }
    if (!createForm.customer_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    const finalPrice = parseInt(createForm.final_price_cop);
    if (!createForm.final_price_cop || isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return;
    }
    if (!createForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    // Check if vehicle is already sold
    const selectedVehicle = vehicles.find(v => v.id === createForm.vehicle_id);
    if (selectedVehicle?.stage_code === "vendido") {
      toast.error("Este vehículo ya está marcado como vendido");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        org_id: profile.org_id,
        vehicle_id: createForm.vehicle_id,
        customer_id: createForm.customer_id,
        final_price_cop: finalPrice,
        payment_method_code: createForm.payment_method_code,
        status: "active",
        created_by: profile.id,
        notes: createForm.notes?.trim() || null,
      };
      console.log("[Sales] Creating sale:", payload);

      const { data, error } = await supabase
        .from("sales")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("[Sales] Create error:", error);
        toast.error(`Error al crear venta: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return;
      }

      if (!data) {
        console.error("[Sales] No data returned");
        toast.error("Error: No se creó la venta (0 filas insertadas)");
        return;
      }

      console.log("[Sales] Sale created:", data.id);

      // Update vehicle to 'vendido'
      console.log("[Sales] Updating vehicle to 'vendido'...");
      const { error: vehError } = await supabase
        .from("vehicles")
        .update({ stage_code: "vendido" })
        .eq("id", createForm.vehicle_id);

      if (vehError) {
        console.error("[Sales] Vehicle update error:", vehError);
        toast.warning(`Venta creada, pero el vehículo no se actualizó: ${vehError.message}`);
      }

      toast.success("Venta creada exitosamente");
      setCreateDialogOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err: any) {
      console.error("[Sales] Unexpected error:", err);
      toast.error(`Error inesperado: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Void sale
  const openVoidDialog = () => {
    if (!selectedSale) return;
    setVoidForm({
      void_reason: "",
      return_stage_code: "publicado",
      refund_amount: "",
      refund_method: paymentMethods[0]?.code || "",
    });
    setVoidDialogOpen(true);
  };

  const handleVoid = async () => {
    if (!selectedSale || !profile?.org_id) return;
    if (!voidForm.void_reason.trim()) {
      toast.error("El motivo de anulación es requerido");
      return;
    }

    setVoiding(true);
    try {
      console.log("[Sales] Voiding sale:", selectedSale.id);
      
      // Step 1: Update sale to voided
      const { error: saleError, data: saleData } = await supabase
        .from("sales")
        .update({
          status: "voided",
          void_reason: voidForm.void_reason.trim(),
          voided_at: new Date().toISOString(),
          voided_by: profile.id,
          return_stage_code: voidForm.return_stage_code,
        })
        .eq("id", selectedSale.id)
        .select();

      if (saleError) {
        console.error("[Sales] Void error:", saleError);
        toast.error(`Error al anular venta: ${saleError.message}${saleError.details ? ` - ${saleError.details}` : ""}`);
        return;
      }

      if (!saleData || saleData.length === 0) {
        console.error("[Sales] Void returned no rows");
        toast.error("Error: La venta no se actualizó (puede que no tengas permisos)");
        return;
      }

      console.log("[Sales] Sale voided successfully");

      // Step 2: Update vehicle stage
      console.log("[Sales] Updating vehicle stage to:", voidForm.return_stage_code);
      const { error: vehError } = await supabase
        .from("vehicles")
        .update({ stage_code: voidForm.return_stage_code })
        .eq("id", selectedSale.vehicle_id);

      if (vehError) {
        console.error("[Sales] Vehicle update error:", vehError);
        toast.warning(`Venta anulada, pero el vehículo no se actualizó: ${vehError.message}`);
      }

      // Step 3: Create refund payment if amount > 0
      const refundAmount = parseInt(voidForm.refund_amount);
      if (voidForm.refund_amount && !isNaN(refundAmount) && refundAmount > 0) {
        console.log("[Sales] Creating refund payment:", refundAmount);
        const { error: refundError } = await supabase.from("sale_payments").insert({
          org_id: profile.org_id,
          sale_id: selectedSale.id,
          amount_cop: refundAmount,
          direction: "out",
          payment_method_code: voidForm.refund_method,
          notes: "Reembolso por anulación",
          created_by: profile.id,
        });

        if (refundError) {
          console.error("[Sales] Refund error:", refundError);
          toast.warning(`Venta anulada, pero el reembolso no se registró: ${refundError.message}`);
        }
      }

      toast.success("Venta anulada exitosamente");
      setVoidDialogOpen(false);
      setDetailOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err: any) {
      console.error("[Sales] Unexpected error:", err);
      toast.error(`Error inesperado: ${err.message}`);
    } finally {
      setVoiding(false);
    }
  };

  // Filter
  const filtered = sales.filter((s) => {
    if (preselectedVehicleId && s.vehicle_id !== preselectedVehicleId) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const plate = s.vehicle?.license_plate?.toLowerCase() || "";
      const brand = s.vehicle?.brand?.toLowerCase() || "";
      const customer = s.customer?.full_name?.toLowerCase() || "";
      if (!plate.includes(q) && !brand.includes(q) && !customer.includes(q)) return false;
    }
    return true;
  });

  const totalPaymentsIn = salePayments
    .filter((p) => p.direction === "in")
    .reduce((sum, p) => sum + p.amount_cop, 0);
  const totalPaymentsOut = salePayments
    .filter((p) => p.direction === "out")
    .reduce((sum, p) => sum + p.amount_cop, 0);

  // Available vehicles for new sale
  const availableVehicles = vehicles.filter(v => v.stage_code !== "vendido");

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!preselectedVehicleId && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, marca, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="voided">Anuladas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Venta
          </Button>
        </div>
      )}

      {preselectedVehicleId && (
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Registrar Venta
        </Button>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin ventas"
          description={preselectedVehicleId ? "Este vehículo no tiene ventas." : "No hay ventas que coincidan con los filtros."}
          action={!preselectedVehicleId ? { label: "Nueva Venta", onClick: openCreate } : undefined}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {!preselectedVehicleId && <TableHead>Vehículo</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Precio Final</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(s.sale_date)}
                    </TableCell>
                    {!preselectedVehicleId && (
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">
                            {s.vehicle?.license_plate || "S/P"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.vehicle?.brand} {s.vehicle?.line || ""} {s.vehicle?.model_year || ""}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.customer?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.customer?.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCOP(s.final_price_cop)}
                    </TableCell>
                    <TableCell>
                      {paymentMethods.find((p) => p.code === s.payment_method_code)?.name || s.payment_method_code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "destructive"}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((s) => (
              <Card key={s.id} className="cursor-pointer" onClick={() => openDetail(s)}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {!preselectedVehicleId && (
                        <>
                          <p className="font-mono text-sm">
                            {s.vehicle?.license_plate || "S/P"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.vehicle?.brand} {s.vehicle?.line || ""}
                          </p>
                        </>
                      )}
                    </div>
                    <Badge variant={s.status === "active" ? "default" : "destructive"}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>{s.customer?.full_name || "—"}</p>
                    <p className="font-medium">{formatCOP(s.final_price_cop)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(s.sale_date)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Sale Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Venta (sin reserva)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!preselectedVehicleId ? (
              <div className="space-y-2">
                <Label>Vehículo *</Label>
                <Select
                  value={createForm.vehicle_id}
                  onValueChange={(v) => setCreateForm({ ...createForm, vehicle_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.license_plate || "S/P"} - {v.brand} {v.line || ""} {v.model_year || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={createForm.customer_id}
                onValueChange={(v) => setCreateForm({ ...createForm, customer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} {c.phone ? `(${c.phone})` : ""}
                    </SelectItem>
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
                  value={createForm.final_price_cop}
                  onChange={(e) => setCreateForm({ ...createForm, final_price_cop: e.target.value })}
                  placeholder="35000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select
                  value={createForm.payment_method_code}
                  onValueChange={(v) => setCreateForm({ ...createForm, payment_method_code: v })}
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
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSale} disabled={saving}>
              {saving ? "Guardando..." : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Detalle de Venta
            </SheetTitle>
          </SheetHeader>

          {selectedSale && (
            <div className="space-y-6 mt-4">
              {/* Status */}
              <Badge
                variant={selectedSale.status === "active" ? "default" : "destructive"}
                className="text-sm"
              >
                {STATUS_LABELS[selectedSale.status] || selectedSale.status}
              </Badge>

              {selectedSale.void_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                  <p className="text-sm font-medium text-destructive">Motivo de anulación:</p>
                  <p className="text-sm">{selectedSale.void_reason}</p>
                </div>
              )}

              {/* Vehicle Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vehículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placa</span>
                    <span className="font-mono">{selectedSale.vehicle?.license_plate || "S/P"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marca/Línea</span>
                    <span>
                      {selectedSale.vehicle?.brand} {selectedSale.vehicle?.line || ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Año</span>
                    <span>{selectedSale.vehicle?.model_year || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre</span>
                    <span>{selectedSale.customer?.full_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teléfono</span>
                    <span>{selectedSale.customer?.phone || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Sale Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Información de Venta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha</span>
                    <span>{formatDate(selectedSale.sale_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio Final</span>
                    <span className="font-bold">{formatCOP(selectedSale.final_price_cop)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Método</span>
                    <span>
                      {paymentMethods.find((p) => p.code === selectedSale.payment_method_code)?.name || selectedSale.payment_method_code}
                    </span>
                  </div>
                  {selectedSale.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground">Notas:</p>
                      <p>{selectedSale.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pagos ({salePayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingDetail ? (
                    <LoadingState variant="table" rows={2} />
                  ) : salePayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {salePayments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm">
                              {paymentMethods.find((pm) => pm.code === p.payment_method_code)?.name || p.payment_method_code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(p.paid_at)}
                              {p.notes && ` · ${p.notes}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={p.direction === "in" ? "default" : "destructive"}>
                              {p.direction === "in" ? "Ingreso" : "Egreso"}
                            </Badge>
                            <p className={`text-sm font-medium ${p.direction === "out" ? "text-destructive" : ""}`}>
                              {p.direction === "out" ? "-" : "+"}{formatCOP(p.amount_cop)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Total Ingresos</span>
                          <span className="text-green-600">{formatCOP(totalPaymentsIn)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Egresos</span>
                          <span className="text-destructive">{formatCOP(totalPaymentsOut)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Neto</span>
                          <span>{formatCOP(totalPaymentsIn - totalPaymentsOut)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              {selectedSale.status === "active" && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={openVoidDialog}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Anular Venta
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Void Dialog */}
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
              <Label>Motivo de anulación *</Label>
              <Textarea
                value={voidForm.void_reason}
                onChange={(e) => setVoidForm({ ...voidForm, void_reason: e.target.value })}
                placeholder="Ej: Cliente desistió, problemas con documentos..."
              />
            </div>
            <div className="space-y-2">
              <Label>Devolver vehículo a estado</Label>
              <Select
                value={voidForm.return_stage_code}
                onValueChange={(v) => setVoidForm({ ...voidForm, return_stage_code: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleStages.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto reembolso (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={voidForm.refund_amount}
                  onChange={(e) => setVoidForm({ ...voidForm, refund_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Método reembolso</Label>
                <Select
                  value={voidForm.refund_method}
                  onValueChange={(v) => setVoidForm({ ...voidForm, refund_method: v })}
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
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={voiding}>
              {voiding ? "Procesando..." : "Anular Venta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
