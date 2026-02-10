import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { validateCustomerData } from "@/lib/validations";
import { Users2, Plus, Pencil, Search, Eye, Bookmark, DollarSign } from "lucide-react";

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
}

interface CustomerHistory {
  reservations: any[];
  sales: any[];
}

export function CustomersTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    document_id: "",
  });

  // Detail sheet state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistory>({ reservations: [], sales: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Duplicate check
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("org_id", profile.org_id)
        .order("full_name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const checkDuplicate = async (phone: string, document_id: string, excludeId?: string) => {
    if (!profile?.org_id) return null;
    
    let query = supabase
      .from("customers")
      .select("id, full_name, phone, document_id")
      .eq("org_id", profile.org_id);

    if (phone || document_id) {
      const conditions = [];
      if (phone) conditions.push(`phone.eq.${phone}`);
      if (document_id) conditions.push(`document_id.eq.${document_id}`);
      query = query.or(conditions.join(","));
    } else {
      return null;
    }

    const { data } = await query;
    
    if (data && data.length > 0) {
      const duplicate = data.find(c => c.id !== excludeId);
      if (duplicate) return duplicate as Customer;
    }
    return null;
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setForm({ full_name: "", email: "", phone: "", document_id: "" });
    setDuplicateWarning(null);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      full_name: customer.full_name,
      email: customer.email || "",
      phone: customer.phone || "",
      document_id: customer.document_id || "",
    });
    setDuplicateWarning(null);
    setDialogOpen(true);
  };

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
    setLoadingHistory(true);

    try {
      const [resRes, salesRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("*, vehicles!sales_vehicle_id_fkey(license_plate, brand, line)")
          .eq("customer_id", customer.id)
          .order("reserved_at", { ascending: false }),
        supabase
          .from("sales")
          .select("*, vehicles!sales_vehicle_id_fkey(license_plate, brand, line)")
          .eq("customer_id", customer.id)
          .order("sale_date", { ascending: false }),
      ]);

      setHistory({
        reservations: resRes.data || [],
        sales: salesRes.data || [],
      });
    } catch (err) {
      console.error("Error fetching customer history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.org_id) return;

    const validation = validateCustomerData(form);
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    // Check for duplicates
    const duplicate = await checkDuplicate(
      form.phone,
      form.document_id,
      editingCustomer?.id
    );

    if (duplicate && !duplicateWarning) {
      setDuplicateWarning(duplicate);
      return;
    }

    setSaving(true);
    try {
      const data = validation.data;

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(data)
          .eq("id", editingCustomer.id);
        if (error) throw error;
        toast.success("Cliente actualizado");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({ ...data, org_id: profile.org_id });
        if (error) throw error;
        toast.success("Cliente creado");
      }

      setDialogOpen(false);
      setDuplicateWarning(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  const openExistingCustomer = () => {
    if (duplicateWarning) {
      setDialogOpen(false);
      openDetail(duplicateWarning);
      setDuplicateWarning(null);
    }
  };

  // Filter customers
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.document_id && c.document_id.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Sin clientes"
          description={search ? "No hay clientes que coincidan con la búsqueda." : "No hay clientes registrados."}
          action={!search ? { label: "Crear Cliente", onClick: openCreate } : undefined}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell>{c.document_id || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <Card key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-sm text-muted-foreground">{c.phone || c.email || "—"}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label>Documento (Cédula/NIT)</Label>
              <Input
                value={form.document_id}
                onChange={(e) => setForm({ ...form, document_id: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="3001234567"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                />
              </div>
            </div>

            {duplicateWarning && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                <p className="text-sm text-destructive font-medium">
                  Ya existe un cliente con este teléfono o documento:
                </p>
                <p className="text-sm mt-1">{duplicateWarning.full_name}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openExistingCustomer}
                  >
                    Abrir existente
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleSave}
                  >
                    Crear de todos modos
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              {selectedCustomer?.full_name}
            </SheetTitle>
          </SheetHeader>

          {selectedCustomer && (
            <div className="space-y-6 mt-4">
              {/* Info */}
              <Card>
                <CardContent className="py-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Documento</span>
                    <span>{selectedCustomer.document_id || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Teléfono</span>
                    <span>{selectedCustomer.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{selectedCustomer.email || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {loadingHistory ? (
                <LoadingState variant="table" rows={3} />
              ) : (
                <>
                  {/* Reservations */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bookmark className="h-4 w-4" />
                        Reservas ({history.reservations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {history.reservations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin reservas</p>
                      ) : (
                        <div className="space-y-2">
                          {history.reservations.map((r: any) => (
                            <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                              <div>
                                <p className="text-sm font-medium">
                                  {r.vehicles?.license_plate || "S/P"} - {r.vehicles?.brand}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(r.reserved_at)}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant={r.status === "active" ? "default" : "secondary"}>
                                  {r.status}
                                </Badge>
                                <p className="text-sm">{formatCOP(r.deposit_amount_cop)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Sales */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Ventas ({history.sales.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {history.sales.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin ventas</p>
                      ) : (
                        <div className="space-y-2">
                          {history.sales.map((s: any) => (
                            <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-0">
                              <div>
                                <p className="text-sm font-medium">
                                  {s.vehicles?.license_plate || "S/P"} - {s.vehicles?.brand}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(s.sale_date)}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant={s.status === "active" ? "default" : "destructive"}>
                                  {s.status}
                                </Badge>
                                <p className="text-sm font-medium">{formatCOP(s.final_price_cop)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              <Button variant="outline" className="w-full" onClick={() => { setDetailOpen(false); openEdit(selectedCustomer); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Cliente
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
