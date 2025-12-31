import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCOP, formatDate } from "@/lib/format";
import { ShoppingCart, Users2, Calendar, CreditCard, Plus, ExternalLink, Pencil } from "lucide-react";

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
}

interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  payment_method_code: string;
  reserved_at: string;
  customer_id: string;
  vehicle_id: string;
  customers?: { full_name: string } | null;
  vehicles?: { license_plate: string | null; brand: string; line: string | null } | null;
}

interface Sale {
  id: string;
  status: string;
  final_price_cop: number;
  payment_method_code: string;
  sale_date: string;
  customer_id: string;
  vehicle_id: string;
  customers?: { full_name: string } | null;
  vehicles?: { license_plate: string | null; brand: string; line: string | null } | null;
}

interface PaymentMethod {
  code: string;
  name: string;
}

export default function AdminSales() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Customer dialog
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ full_name: "", email: "", phone: "", document_id: "" });
  const [saving, setSaving] = useState(false);

  // Filters
  const [reservationStatus, setReservationStatus] = useState<string>("all");
  const [saleStatus, setSaleStatus] = useState<string>("all");

  const fetchData = async () => {
    if (!profile?.org_id) return;

    const [customersRes, reservationsRes, salesRes, paymentMethodsRes] = await Promise.all([
      supabase.from("customers").select("*").eq("org_id", profile.org_id).order("full_name"),
      supabase.from("reservations").select(`
        *,
        customers(full_name),
        vehicles(license_plate, brand, line)
      `).eq("org_id", profile.org_id).order("reserved_at", { ascending: false }),
      supabase.from("sales").select(`
        *,
        customers(full_name),
        vehicles(license_plate, brand, line)
      `).eq("org_id", profile.org_id).order("sale_date", { ascending: false }),
      supabase.from("payment_methods").select("code, name").eq("is_active", true),
    ]);

    if (customersRes.error) console.error("Error fetching customers:", customersRes.error);
    if (reservationsRes.error) console.error("Error fetching reservations:", reservationsRes.error);
    if (salesRes.error) console.error("Error fetching sales:", salesRes.error);

    setCustomers(customersRes.data || []);
    setReservations((reservationsRes.data || []).map(r => ({
      ...r,
      customers: r.customers as Reservation["customers"],
      vehicles: r.vehicles as Reservation["vehicles"],
    })));
    setSales((salesRes.data || []).map(s => ({
      ...s,
      customers: s.customers as Sale["customers"],
      vehicles: s.vehicles as Sale["vehicles"],
    })));
    setPaymentMethods(paymentMethodsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [profile?.org_id]);

  const openCreateCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ full_name: "", email: "", phone: "", document_id: "" });
    setCustomerDialogOpen(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      full_name: customer.full_name,
      email: customer.email || "",
      phone: customer.phone || "",
      document_id: customer.document_id || "",
    });
    setCustomerDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.full_name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" });
      return;
    }

    setSaving(true);

    const data = {
      full_name: customerForm.full_name.trim(),
      email: customerForm.email.trim() || null,
      phone: customerForm.phone.trim() || null,
      document_id: customerForm.document_id.trim() || null,
    };

    if (editingCustomer) {
      const { error } = await supabase.from("customers").update(data).eq("id", editingCustomer.id);
      if (error) {
        console.error("Error updating customer:", error);
        toast({ title: "Error", description: "No se pudo actualizar el cliente", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Cliente actualizado" });
        setCustomerDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("customers").insert({ ...data, org_id: profile!.org_id });
      if (error) {
        console.error("Error creating customer:", error);
        toast({ title: "Error", description: "No se pudo crear el cliente", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Cliente creado" });
        setCustomerDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      converted: "secondary",
      cancelled: "destructive",
      expired: "outline",
      voided: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const filteredReservations = reservations.filter(r => 
    reservationStatus === "all" || r.status === reservationStatus
  );

  const filteredSales = sales.filter(s => 
    saleStatus === "all" || s.status === saleStatus
  );

  if (loading) {
    return (
      <AdminLayout title="Ventas" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Ventas" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Ventas" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Ventas" }]}>
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers" className="gap-2">
            <Users2 className="h-4 w-4" />
            Clientes ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <Calendar className="h-4 w-4" />
            Reservas ({reservations.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Ventas ({sales.length})
          </TabsTrigger>
        </TabsList>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateCustomer}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>

          {customers.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="Sin clientes"
              description="No hay clientes registrados."
              action={{ label: "Crear Cliente", onClick: openCreateCustomer }}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.full_name}</TableCell>
                      <TableCell>{customer.document_id || "-"}</TableCell>
                      <TableCell>{customer.email || "-"}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditCustomer(customer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* RESERVATIONS TAB */}
        <TabsContent value="reservations" className="space-y-4">
          <div className="flex gap-4">
            <Select value={reservationStatus} onValueChange={setReservationStatus}>
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
          </div>

          {filteredReservations.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin reservas"
              description="No hay reservas que coincidan con los filtros."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.reserved_at)}</TableCell>
                      <TableCell>{r.customers?.full_name || "-"}</TableCell>
                      <TableCell>
                        {r.vehicles ? (
                          <span>{r.vehicles.license_plate || "Sin placa"} - {r.vehicles.brand}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{formatCOP(r.deposit_amount_cop)}</TableCell>
                      <TableCell>{r.payment_method_code}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/vehicles/${r.vehicle_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* SALES TAB */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex gap-4">
            <Select value={saleStatus} onValueChange={setSaleStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="voided">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredSales.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Sin ventas"
              description="No hay ventas que coincidan con los filtros."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Precio Final</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.sale_date)}</TableCell>
                      <TableCell>{s.customers?.full_name || "-"}</TableCell>
                      <TableCell>
                        {s.vehicles ? (
                          <span>{s.vehicles.license_plate || "Sin placa"} - {s.vehicles.brand}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{formatCOP(s.final_price_cop)}</TableCell>
                      <TableCell>{s.payment_method_code}</TableCell>
                      <TableCell>{getStatusBadge(s.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/vehicles/${s.vehicle_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo *</Label>
              <Input
                id="full_name"
                value={customerForm.full_name}
                onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_id">Documento (Cédula/NIT)</Label>
              <Input
                id="document_id"
                value={customerForm.document_id}
                onChange={(e) => setCustomerForm({ ...customerForm, document_id: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCustomer} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
