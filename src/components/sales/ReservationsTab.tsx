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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Calendar, Plus, Search, X, ArrowRight, Eye } from "lucide-react";

interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  payment_method_code: string;
  reserved_at: string;
  notes: string | null;
  customer_id: string;
  vehicle_id: string;
  created_by: string | null;
  cancel_reason: string | null;
  customer?: { full_name: string; phone: string | null };
  vehicle?: { license_plate: string | null; brand: string; line: string | null; model_year: number | null };
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

interface PaymentMethod {
  code: string;
  name: string;
}

interface Props {
  onConvertToSale?: (reservation: Reservation) => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  converted: "Convertida",
  cancelled: "Cancelada",
  expired: "Expirada",
};

export function ReservationsTab({ onConvertToSale }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    customer_id: "",
    deposit_amount_cop: "",
    payment_method_code: "",
    notes: "",
  });

  // Quick create customer
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ full_name: "", phone: "" });

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingReservation, setCancelingReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [resRes, vehRes, custRes, pmRes] = await Promise.all([
        supabase
          .from("reservations")
          .select(`
            *,
            customer:customers(full_name, phone),
            vehicle:vehicles(license_plate, brand, line, model_year)
          `)
          .eq("org_id", profile.org_id)
          .order("reserved_at", { ascending: false }),
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
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
      ]);

      setReservations(
        (resRes.data || []).map((r: any) => ({
          ...r,
          customer: r.customer,
          vehicle: r.vehicle,
        }))
      );
      setVehicles(vehRes.data || []);
      setCustomers(custRes.data || []);
      setPaymentMethods(pmRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setForm({
      vehicle_id: "",
      customer_id: "",
      deposit_amount_cop: "",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
    });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!profile?.org_id) return;

    if (!form.vehicle_id) {
      toast.error("Selecciona un vehículo");
      return;
    }
    if (!form.customer_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!form.deposit_amount_cop || parseInt(form.deposit_amount_cop) <= 0) {
      toast.error("El depósito debe ser mayor a 0");
      return;
    }
    if (!form.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    // Check for existing active reservation
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("vehicle_id", form.vehicle_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      toast.error("Este vehículo ya tiene una reserva activa");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        org_id: profile.org_id,
        vehicle_id: form.vehicle_id,
        customer_id: form.customer_id,
        deposit_amount_cop: parseInt(form.deposit_amount_cop),
        payment_method_code: form.payment_method_code,
        notes: form.notes || null,
        status: "active",
        created_by: profile.id,
      });

      if (error) throw error;

      // Update vehicle stage to 'bloqueado'
      await supabase
        .from("vehicles")
        .update({ stage_code: "bloqueado" })
        .eq("id", form.vehicle_id);

      toast.success("Reserva creada exitosamente");
      setCreateDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al crear reserva");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!profile?.org_id) return;
    if (!quickCustomerForm.full_name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: profile.org_id,
          full_name: quickCustomerForm.full_name.trim(),
          phone: quickCustomerForm.phone || null,
        })
        .select("id, full_name, phone")
        .single();

      if (error) throw error;

      setCustomers((prev) => [...prev, data]);
      setForm({ ...form, customer_id: data.id });
      setQuickCustomerOpen(false);
      setQuickCustomerForm({ full_name: "", phone: "" });
      toast.success("Cliente creado");
    } catch (err: any) {
      toast.error(err.message || "Error al crear cliente");
    }
  };

  const openCancel = (reservation: Reservation) => {
    setCancelingReservation(reservation);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelingReservation) return;

    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile?.id,
        })
        .eq("id", cancelingReservation.id);

      if (error) throw error;

      // Check if there are other active reservations for this vehicle
      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", cancelingReservation.vehicle_id)
        .eq("status", "active")
        .neq("id", cancelingReservation.id);

      if (!otherActive || otherActive.length === 0) {
        // Return vehicle to 'publicado'
        await supabase
          .from("vehicles")
          .update({ stage_code: "publicado" })
          .eq("id", cancelingReservation.vehicle_id);
      }

      toast.success("Reserva cancelada");
      setCancelDialogOpen(false);
      setCancelingReservation(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al cancelar reserva");
    }
  };

  const handleConvert = (reservation: Reservation) => {
    if (onConvertToSale) {
      onConvertToSale(reservation);
    }
  };

  // Filter
  const filtered = reservations.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const plate = r.vehicle?.license_plate?.toLowerCase() || "";
      const brand = r.vehicle?.brand?.toLowerCase() || "";
      const customer = r.customer?.full_name?.toLowerCase() || "";
      if (!plate.includes(q) && !brand.includes(q) && !customer.includes(q)) return false;
    }
    return true;
  });

  // Available vehicles (not already reserved active)
  const availableVehicles = vehicles.filter((v) => {
    const hasActiveReservation = reservations.some(
      (r) => r.vehicle_id === v.id && r.status === "active"
    );
    return !hasActiveReservation;
  });

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {/* Filters */}
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
            <SelectItem value="converted">Convertidas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="expired">Expiradas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Reserva
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Sin reservas"
          description="No hay reservas que coincidan con los filtros."
          action={{ label: "Crear Reserva", onClick: openCreate }}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(r.reserved_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">
                          {r.vehicle?.license_plate || "S/P"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.vehicle?.brand} {r.vehicle?.line || ""} {r.vehicle?.model_year || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.customer?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.customer?.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCOP(r.deposit_amount_cop)}
                    </TableCell>
                    <TableCell>
                      {paymentMethods.find((p) => p.code === r.payment_method_code)?.name || r.payment_method_code}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "active"
                            ? "default"
                            : r.status === "converted"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "active" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConvert(r)}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Vender
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => openCancel(r)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono text-sm">
                        {r.vehicle?.license_plate || "S/P"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.vehicle?.brand} {r.vehicle?.line || ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        r.status === "active"
                          ? "default"
                          : r.status === "converted"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>{r.customer?.full_name || "—"}</p>
                    <p className="font-medium">{formatCOP(r.deposit_amount_cop)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.reserved_at)}</p>
                  </div>
                  {r.status === "active" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" onClick={() => handleConvert(r)}>
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Vender
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openCancel(r)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select
                value={form.vehicle_id}
                onValueChange={(v) => setForm({ ...form, vehicle_id: v })}
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
              {availableVehicles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay vehículos disponibles para reservar
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente *</Label>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setQuickCustomerOpen(true)}
                >
                  + Crear rápido
                </Button>
              </div>
              <Select
                value={form.customer_id}
                onValueChange={(v) => setForm({ ...form, customer_id: v })}
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
                <Label>Depósito (COP) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.deposit_amount_cop}
                  onChange={(e) => setForm({ ...form, deposit_amount_cop: e.target.value })}
                  placeholder="1000000"
                />
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
              {saving ? "Guardando..." : "Crear Reserva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Create Customer Dialog */}
      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Cliente Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={quickCustomerForm.full_name}
                onChange={(e) =>
                  setQuickCustomerForm({ ...quickCustomerForm, full_name: e.target.value })
                }
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={quickCustomerForm.phone}
                onChange={(e) =>
                  setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })
                }
                placeholder="3001234567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCustomerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleQuickCreateCustomer}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la reserva y liberará el vehículo si no hay otras reservas activas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo de cancelación (opcional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej: Cliente desistió..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancelar Reserva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
