import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Plus, DollarSign, Pencil, Trash2 } from "lucide-react";
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

interface Props {
  vehicleId: string;
}

interface Expense {
  id: string;
  amount_cop: number;
  incurred_at: string | null;
  description: string | null;
  work_order_item_id: string | null;
  vendor_profile_id: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  work_order_item_title?: string;
  vendor_name?: string;
  created_by_name?: string;
}

interface WorkOrderItem {
  id: string;
  title: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
}

export function VehicleExpensesTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workOrderItems, setWorkOrderItems] = useState<WorkOrderItem[]>([]);
  const [vendors, setVendors] = useState<Profile[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    amount_cop: "",
    incurred_at: new Date().toISOString().split("T")[0],
    description: "",
    work_order_item_id: "",
    vendor_profile_id: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch expenses with joins
      const { data: expensesData } = await supabase
        .from("vehicle_expenses")
        .select(
          `
          *,
          work_order_items:work_order_item_id(title),
          vendor:vendor_profile_id(full_name),
          creator:created_by(full_name)
        `
        )
        .eq("vehicle_id", vehicleId)
        .order("incurred_at", { ascending: false });

      // Enrich expenses
      const enriched: Expense[] = (expensesData || []).map((e: any) => ({
        ...e,
        work_order_item_title: e.work_order_items?.title || null,
        vendor_name: e.vendor?.full_name || null,
        created_by_name: e.creator?.full_name || null,
      }));
      setExpenses(enriched);

      // Fetch open work order items for linking
      const { data: woData } = await supabase
        .from("work_orders")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("status", "open")
        .maybeSingle();

      if (woData) {
        const { data: itemsData } = await supabase
          .from("work_order_items")
          .select("id, title")
          .eq("work_order_id", woData.id)
          .order("title");
        setWorkOrderItems(itemsData || []);
      } else {
        setWorkOrderItems([]);
      }

      // Fetch vendors (profiles with role='vendor' or all if none)
      const { data: vendorsData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("is_active", true)
        .order("full_name");

      // Prioritize vendors, but allow any profile
      const vendorProfiles = (vendorsData || []).filter(
        (p) => p.role === "vendor"
      );
      setVendors(vendorProfiles.length > 0 ? vendorProfiles : vendorsData || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditingExpense(null);
    setForm({
      amount_cop: "",
      incurred_at: new Date().toISOString().split("T")[0],
      description: "",
      work_order_item_id: "",
      vendor_profile_id: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setForm({
      amount_cop: expense.amount_cop.toString(),
      incurred_at: expense.incurred_at || "",
      description: expense.description || "",
      work_order_item_id: expense.work_order_item_id || "",
      vendor_profile_id: expense.vendor_profile_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!profile?.org_id || !form.amount_cop) {
      toast.error("El monto es requerido");
      return;
    }
    if (!form.description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        amount_cop: parseInt(form.amount_cop),
        incurred_at: form.incurred_at || null,
        description: form.description.trim(),
        work_order_item_id: form.work_order_item_id || null,
        vendor_profile_id: form.vendor_profile_id || null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("vehicle_expenses")
          .update(payload)
          .eq("id", editingExpense.id);
        if (error) throw error;
        toast.success("Gasto actualizado");
      } else {
        const { error } = await supabase.from("vehicle_expenses").insert({
          ...payload,
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          created_by: profile.id,
        });
        if (error) throw error;
        toast.success("Gasto registrado");
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("vehicle_expenses")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success("Gasto eliminado");
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  if (loading) return <LoadingState variant="table" />;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_cop || 0), 0);

  return (
    <div className="space-y-6">
      {/* Total Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCOP(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">
            {expenses.length} registro{expenses.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Registrar Gasto
        </Button>
      </div>

      {/* Expenses Table/List */}
      {expenses.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Sin gastos registrados"
          description="Registra los gastos asociados a este vehículo."
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vinculado a</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Creado por</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="whitespace-nowrap">
                      {exp.incurred_at ? formatDate(exp.incurred_at) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {exp.description || "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCOP(exp.amount_cop)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exp.work_order_item_title || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {exp.vendor_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exp.created_by_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(exp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {expenses.map((exp) => (
              <Card key={exp.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{formatCOP(exp.amount_cop)}</p>
                      <p className="text-sm text-muted-foreground">
                        {exp.description || "Sin descripción"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(exp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      {exp.incurred_at ? formatDate(exp.incurred_at) : "—"} ·{" "}
                      {exp.created_by_name || "—"}
                    </p>
                    {exp.work_order_item_title && (
                      <p>Ítem: {exp.work_order_item_title}</p>
                    )}
                    {exp.vendor_name && <p>Proveedor: {exp.vendor_name}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog: Create/Edit Expense */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Editar Gasto" : "Nuevo Gasto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto (COP) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.amount_cop}
                  onChange={(e) =>
                    setForm({ ...form, amount_cop: e.target.value })
                  }
                  placeholder="500000"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.incurred_at}
                  onChange={(e) =>
                    setForm({ ...form, incurred_at: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Detalle del gasto..."
              />
            </div>

            {workOrderItems.length > 0 && (
              <div className="space-y-2">
                <Label>Vincular a ítem de alistamiento</Label>
                <Select
                  value={form.work_order_item_id}
                  onValueChange={(v) =>
                    setForm({ ...form, work_order_item_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguno</SelectItem>
                    {workOrderItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {vendors.length > 0 && (
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select
                  value={form.vendor_profile_id}
                  onValueChange={(v) =>
                    setForm({ ...form, vendor_profile_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguno</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.full_name || "Usuario"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* Dialog: Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
