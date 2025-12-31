import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import {
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Pause,
  ClipboardList,
  Lock,
  Save,
  Trash2,
} from "lucide-react";
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

interface WorkOrder {
  id: string;
  status: string;
  scope: string;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

interface WorkOrderItem {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  operation_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
}

interface CatalogOp {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  pending: { label: "Pendiente", icon: Clock, color: "text-muted-foreground" },
  in_progress: { label: "En Progreso", icon: AlertCircle, color: "text-primary" },
  done: { label: "Completado", icon: CheckCircle, color: "text-success" },
  blocked: { label: "Bloqueado", icon: Pause, color: "text-destructive" },
};

export function VehicleWorkOrdersTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [openWorkOrder, setOpenWorkOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogOp[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Dialogs
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Selection for catalog
  const [selectedOps, setSelectedOps] = useState<string[]>([]);

  // Manual item form
  const [manualForm, setManualForm] = useState({ title: "", notes: "" });

  // Saving states
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, catalogRes, profilesRes] = await Promise.all([
        supabase
          .from("work_orders")
          .select("*")
          .eq("vehicle_id", vehicleId)
          .order("opened_at", { ascending: false }),
        supabase
          .from("operation_catalog")
          .select("id, code, name, category")
          .eq("scope", "vehicle")
          .eq("is_active", true)
          .order("name"),
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
      ]);

      const orders = woRes.data || [];
      const openOrder = orders.find((o) => o.status === "open") || null;
      setOpenWorkOrder(openOrder);
      setCatalog(catalogRes.data || []);
      setProfiles(profilesRes.data || []);

      if (openOrder) {
        const { data: itemsData } = await supabase
          .from("work_order_items")
          .select("*")
          .eq("work_order_id", openOrder.id)
          .order("updated_at", { ascending: false });
        setItems(itemsData || []);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Error fetching work order data:", err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create new work order
  const createWorkOrder = async () => {
    if (!profile?.org_id) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("work_orders").insert({
        org_id: profile.org_id,
        vehicle_id: vehicleId,
        scope: "vehicle",
        status: "open",
        opened_by: profile.id,
      });
      if (error) throw error;
      toast.success("Orden de alistamiento creada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al crear orden");
    } finally {
      setCreating(false);
    }
  };

  // Add items from catalog
  const addItemsFromCatalog = async () => {
    if (!openWorkOrder || !profile?.org_id || selectedOps.length === 0) return;

    try {
      const newItems = selectedOps.map((opId) => {
        const op = catalog.find((c) => c.id === opId);
        return {
          org_id: profile.org_id,
          work_order_id: openWorkOrder.id,
          operation_id: opId,
          title: op?.name || "Operación",
          status: "pending",
        };
      });

      const { error } = await supabase.from("work_order_items").insert(newItems);
      if (error) throw error;

      toast.success(`${selectedOps.length} ítems agregados`);
      setSelectedOps([]);
      setCatalogDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al agregar ítems");
    }
  };

  // Add manual item
  const addManualItem = async () => {
    if (!openWorkOrder || !profile?.org_id || !manualForm.title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const { error } = await supabase.from("work_order_items").insert({
        org_id: profile.org_id,
        work_order_id: openWorkOrder.id,
        title: manualForm.title.trim(),
        notes: manualForm.notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Ítem agregado");
      setManualForm({ title: "", notes: "" });
      setManualDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al agregar ítem");
    }
  };

  // Update item inline
  const updateItem = async (
    itemId: string,
    updates: Partial<WorkOrderItem>
  ) => {
    try {
      // Auto-set completed_at when status changes to done
      if (updates.status === "done") {
        updates.completed_at = new Date().toISOString();
      } else if (updates.status && updates.status !== "done") {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from("work_order_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
      );
      toast.success("Actualizado");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    }
  };

  // Delete item
  const deleteItem = async () => {
    if (!deleteItemId) return;
    try {
      const { error } = await supabase
        .from("work_order_items")
        .delete()
        .eq("id", deleteItemId);
      if (error) throw error;

      toast.success("Ítem eliminado");
      setItems((prev) => prev.filter((i) => i.id !== deleteItemId));
      setDeleteItemId(null);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  // Close work order
  const closeWorkOrder = async () => {
    if (!openWorkOrder) return;
    setClosing(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", openWorkOrder.id);

      if (error) throw error;
      toast.success("Orden cerrada");
      setCloseDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al cerrar orden");
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  // Calculate stats
  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.status === "done").length,
    blocked: items.filter((i) => i.status === "blocked").length,
  };
  const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const allDone = stats.total > 0 && stats.done === stats.total;

  return (
    <div className="space-y-6">
      {!openWorkOrder ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={ClipboardList}
              title="Sin orden de alistamiento activa"
              description="Crea una orden para gestionar las operaciones del vehículo."
              action={{
                label: creating ? "Creando..." : "Crear Orden de Alistamiento",
                onClick: createWorkOrder,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Progreso del Alistamiento</CardTitle>
                <Badge variant={allDone ? "default" : "secondary"}>
                  {progress}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-2" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
                <div className="bg-muted rounded p-2">
                  <p className="text-lg font-semibold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
                <div className="bg-primary/10 rounded p-2">
                  <p className="text-lg font-semibold text-primary">
                    {stats.in_progress}
                  </p>
                  <p className="text-xs text-muted-foreground">En Progreso</p>
                </div>
                <div className="bg-success/10 rounded p-2">
                  <p className="text-lg font-semibold text-success">{stats.done}</p>
                  <p className="text-xs text-muted-foreground">Completados</p>
                </div>
                <div className="bg-destructive/10 rounded p-2">
                  <p className="text-lg font-semibold text-destructive">
                    {stats.blocked}
                  </p>
                  <p className="text-xs text-muted-foreground">Bloqueados</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Abierta: {formatDate(openWorkOrder.opened_at)}
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Desde Catálogo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ítem Manual
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCloseDialogOpen(true)}
              disabled={!allDone && stats.total > 0}
            >
              <Lock className="h-4 w-4 mr-1" />
              Cerrar Orden
            </Button>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin ítems"
              description="Agrega operaciones desde el catálogo o manualmente."
            />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const assignedProfile = profiles.find(
                  (p) => p.id === item.assigned_to
                );

                return (
                  <Card key={item.id}>
                    <CardContent className="py-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Title & Status Icon */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Icon className={`h-5 w-5 mt-0.5 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{item.title}</p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.notes}
                              </p>
                            )}
                            {item.completed_at && (
                              <p className="text-xs text-success">
                                Completado: {formatDate(item.completed_at)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={item.status}
                            onValueChange={(v) => updateItem(item.id, { status: v })}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="in_progress">En Progreso</SelectItem>
                              <SelectItem value="done">Completado</SelectItem>
                              <SelectItem value="blocked">Bloqueado</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={item.assigned_to || "unassigned"}
                            onValueChange={(v) =>
                              updateItem(item.id, {
                                assigned_to: v === "unassigned" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue placeholder="Asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name || "Usuario"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            type="date"
                            className="w-[130px] h-8"
                            value={item.due_date || ""}
                            onChange={(e) =>
                              updateItem(item.id, {
                                due_date: e.target.value || null,
                              })
                            }
                          />

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteItemId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Dialog: Add from Catalog */}
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar desde Catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay operaciones en el catálogo.
              </p>
            ) : (
              catalog.map((op) => (
                <div key={op.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={op.id}
                    checked={selectedOps.includes(op.id)}
                    onCheckedChange={(checked) => {
                      setSelectedOps((prev) =>
                        checked
                          ? [...prev, op.id]
                          : prev.filter((id) => id !== op.id)
                      );
                    }}
                  />
                  <label
                    htmlFor={op.id}
                    className="text-sm flex-1 cursor-pointer"
                  >
                    <span className="font-medium">{op.name}</span>
                    {op.category && (
                      <span className="text-muted-foreground ml-2">
                        ({op.category})
                      </span>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addItemsFromCatalog} disabled={selectedOps.length === 0}>
              Agregar ({selectedOps.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manual Item */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Ítem Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={manualForm.title}
                onChange={(e) =>
                  setManualForm({ ...manualForm, title: e.target.value })
                }
                placeholder="Nombre de la operación"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) =>
                  setManualForm({ ...manualForm, notes: e.target.value })
                }
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addManualItem} disabled={!manualForm.title.trim()}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Close Work Order */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar orden de alistamiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {allDone
                ? "Todos los ítems están completados. La orden se marcará como cerrada."
                : "Aún hay ítems sin completar. ¿Deseas cerrar de todos modos?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={closeWorkOrder} disabled={closing}>
              {closing ? "Cerrando..." : "Cerrar Orden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Delete Item */}
      <AlertDialog
        open={!!deleteItemId}
        onOpenChange={() => setDeleteItemId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteItem}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
