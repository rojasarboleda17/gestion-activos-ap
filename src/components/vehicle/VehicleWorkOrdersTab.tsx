import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, CheckCircle, Clock, AlertCircle, Pause } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  vehicleId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", icon: Clock, variant: "secondary" },
  in_progress: { label: "En Progreso", icon: AlertCircle, variant: "default" },
  done: { label: "Completado", icon: CheckCircle, variant: "outline" },
  blocked: { label: "Bloqueado", icon: Pause, variant: "destructive" },
};

export function VehicleWorkOrdersTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [openWorkOrder, setOpenWorkOrder] = useState<any>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedOps, setSelectedOps] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const [woRes, catalogRes, profilesRes] = await Promise.all([
      supabase.from("work_orders").select("*").eq("vehicle_id", vehicleId).order("opened_at", { ascending: false }),
      supabase.from("operation_catalog").select("*").eq("scope", "vehicle").eq("is_active", true),
      supabase.from("profiles").select("id, full_name").eq("is_active", true),
    ]);

    const orders = woRes.data || [];
    setWorkOrders(orders);
    setCatalog(catalogRes.data || []);
    setProfiles(profilesRes.data || []);

    const openOrder = orders.find((o) => o.status === "open");
    setOpenWorkOrder(openOrder);

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
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [vehicleId]);

  const createWorkOrder = async () => {
    if (!profile?.org_id) return;
    try {
      const { error } = await supabase.from("work_orders").insert({
        org_id: profile.org_id,
        vehicle_id: vehicleId,
        scope: "vehicle",
        status: "open",
        opened_by: profile.id,
      });
      if (error) throw error;
      toast.success("Orden de trabajo creada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
      setCatalogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateItem = async (itemId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("work_order_items")
        .update(updates)
        .eq("id", itemId);
      if (error) throw error;
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)));
      toast.success("Ítem actualizado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  const completedCount = items.filter((i) => i.status === "done").length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {!openWorkOrder ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Plus}
              title="Sin orden de trabajo activa"
              description="Crea una orden de alistamiento para gestionar las operaciones pendientes."
              action={{ label: "Crear Orden de Trabajo", onClick: createWorkOrder }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex justify-between items-center">
                <span>Progreso del Alistamiento</span>
                <Badge variant="outline">{progress}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {completedCount} de {items.length} operaciones completadas
              </p>
            </CardContent>
          </Card>

          {/* Add Items */}
          <div className="flex justify-end">
            <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar desde Catálogo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Seleccionar Operaciones</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {catalog.map((op) => (
                    <div key={op.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={op.id}
                        checked={selectedOps.includes(op.id)}
                        onCheckedChange={(checked) => {
                          setSelectedOps((prev) =>
                            checked ? [...prev, op.id] : prev.filter((id) => id !== op.id)
                          );
                        }}
                      />
                      <label htmlFor={op.id} className="text-sm flex-1 cursor-pointer">
                        <span className="font-medium">{op.name}</span>
                        {op.category && <span className="text-muted-foreground ml-2">({op.category})</span>}
                      </label>
                    </div>
                  ))}
                </div>
                <Button onClick={addItemsFromCatalog} disabled={selectedOps.length === 0} className="mt-4">
                  Agregar {selectedOps.length > 0 && `(${selectedOps.length})`}
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {items.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <Card key={item.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{item.title}</span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateItem(item.id, { status: v, completed_at: v === "done" ? new Date().toISOString() : null })}
                        >
                          <SelectTrigger className="w-[140px] h-8">
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
                          onValueChange={(v) => updateItem(item.id, { assigned_to: v === "unassigned" ? null : v })}
                        >
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || "Usuario"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
