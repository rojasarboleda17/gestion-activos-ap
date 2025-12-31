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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Plus, Pencil, ClipboardList, ExternalLink } from "lucide-react";

interface Operation {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  scope: string;
  is_active: boolean;
}

interface WorkOrder {
  id: string;
  status: string;
  scope: string;
  notes: string | null;
  opened_at: string;
  vehicle_id: string | null;
  vehicles?: { license_plate: string | null; brand: string; line: string | null } | null;
  items_count?: number;
  pending_count?: number;
}

const SCOPES = ["vehicle", "general", "administrative"];
const CATEGORIES = ["mecánica", "eléctrica", "carrocería", "limpieza", "documentación", "otro"];

export default function AdminOperations() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    scope: "vehicle",
  });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<string>("all");

  const fetchData = async () => {
    if (!profile?.org_id) return;

    const [opsRes, woRes] = await Promise.all([
      supabase
        .from("operation_catalog")
        .select("*")
        .eq("org_id", profile.org_id)
        .order("code"),
      supabase
        .from("work_orders")
        .select(`
          *,
          vehicles(license_plate, brand, line)
        `)
        .eq("org_id", profile.org_id)
        .eq("status", "open")
        .order("opened_at", { ascending: false }),
    ]);

    if (opsRes.error) console.error("Error fetching operations:", opsRes.error);
    if (woRes.error) console.error("Error fetching work orders:", woRes.error);

    setOperations(opsRes.data || []);

    // Fetch item counts for each work order
    if (woRes.data && woRes.data.length > 0) {
      const woIds = woRes.data.map(wo => wo.id);
      const { data: items } = await supabase
        .from("work_order_items")
        .select("work_order_id, status")
        .in("work_order_id", woIds);

      const counts: Record<string, { total: number; pending: number }> = {};
      items?.forEach(item => {
        if (!counts[item.work_order_id]) {
          counts[item.work_order_id] = { total: 0, pending: 0 };
        }
        counts[item.work_order_id].total++;
        if (item.status === "pending" || item.status === "blocked") {
          counts[item.work_order_id].pending++;
        }
      });

      const enrichedWOs = woRes.data.map(wo => ({
        ...wo,
        vehicles: wo.vehicles as WorkOrder["vehicles"],
        items_count: counts[wo.id]?.total || 0,
        pending_count: counts[wo.id]?.pending || 0,
      }));
      setWorkOrders(enrichedWOs);
    } else {
      setWorkOrders([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [profile?.org_id]);

  const openCreateDialog = () => {
    setEditingOp(null);
    setFormData({ code: "", name: "", description: "", category: "", scope: "vehicle" });
    setDialogOpen(true);
  };

  const openEditDialog = (op: Operation) => {
    setEditingOp(op);
    setFormData({
      code: op.code,
      name: op.name,
      description: op.description || "",
      category: op.category || "",
      scope: op.scope,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: "Error", description: "Código y nombre son requeridos", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingOp) {
      const { error } = await supabase
        .from("operation_catalog")
        .update({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category || null,
          scope: formData.scope,
        })
        .eq("id", editingOp.id);

      if (error) {
        console.error("Error updating operation:", error);
        toast({ title: "Error", description: "No se pudo actualizar la operación", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Operación actualizada" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("operation_catalog")
        .insert({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category || null,
          scope: formData.scope,
          org_id: profile!.org_id,
        });

      if (error) {
        console.error("Error creating operation:", error);
        toast({ title: "Error", description: "No se pudo crear la operación", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Operación creada" });
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (op: Operation) => {
    const { error } = await supabase
      .from("operation_catalog")
      .update({ is_active: !op.is_active })
      .eq("id", op.id);

    if (error) {
      console.error("Error toggling operation:", error);
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const filteredOperations = operations.filter(op => {
    const matchesSearch = op.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          op.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesScope = filterScope === "all" || op.scope === filterScope;
    return matchesSearch && matchesScope;
  });

  if (loading) {
    return (
      <AdminLayout title="Operaciones" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Operaciones" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Operaciones" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Operaciones" }]}>
      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-2">
            <Wrench className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="workorders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Órdenes Abiertas ({workOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:w-64"
            />
            <Select value={filterScope} onValueChange={setFilterScope}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {SCOPES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog} className="sm:ml-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Operación
            </Button>
          </div>

          {filteredOperations.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Sin operaciones"
              description="No hay operaciones en el catálogo. Crea la primera para comenzar."
              action={{ label: "Crear Operación", onClick: openCreateDialog }}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono">{op.code}</TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>{op.category || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{op.scope}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={op.is_active}
                          onCheckedChange={() => toggleActive(op)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(op)}>
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

        <TabsContent value="workorders">
          {workOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin órdenes abiertas"
              description="No hay órdenes de trabajo abiertas actualmente."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Abierto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell>
                        {wo.vehicles ? (
                          <span>
                            {wo.vehicles.license_plate || "Sin placa"} - {wo.vehicles.brand} {wo.vehicles.line}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">General</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{wo.scope}</Badge>
                      </TableCell>
                      <TableCell>{wo.items_count}</TableCell>
                      <TableCell>
                        {wo.pending_count > 0 ? (
                          <Badge variant="destructive">{wo.pending_count}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(wo.opened_at).toLocaleDateString("es-CO")}
                      </TableCell>
                      <TableCell className="text-right">
                        {wo.vehicle_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/vehicles/${wo.vehicle_id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOp ? "Editar Operación" : "Nueva Operación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="OP-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">Scope *</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(v) => setFormData({ ...formData, scope: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Cambio de aceite"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la operación..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
