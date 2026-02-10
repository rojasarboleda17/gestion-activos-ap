import { useState, useEffect, useMemo, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Search, X, Car, Users, AlertTriangle, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Branch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface BranchMetrics {
  vehicles_count: number;
  users_count: number;
}

export default function AdminBranches() {
  const { profile } = useAuth();
  
  // Data states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [metrics, setMetrics] = useState<Record<string, BranchMetrics>>({});
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  
  // UI states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", city: "", address: "", is_active: true });
  const [saving, setSaving] = useState(false);
  
  // Deactivate confirmation
  const [deactivatingBranch, setDeactivatingBranch] = useState<Branch | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("org_id", profile.org_id)
        .order("name");

      if (error) {
        console.error("Error fetching branches:", error);
        toast.error(`Error al cargar sedes: ${error.message}`);
        return;
      }
      
      setBranches(data || []);
      
      // Fetch metrics for each branch
      if (data && data.length > 0) {
        await fetchMetrics(data.map(b => b.id));
      }
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  const fetchMetrics = async (branchIds: string[]) => {
    if (branchIds.length === 0) return;
    
    try {
      // Fetch vehicle counts
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("branch_id")
        .in("branch_id", branchIds)
        .eq("is_archived", false);

      if (vehiclesError) {
        console.error("Error fetching vehicle counts:", vehiclesError);
      }

      // Fetch user counts
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("branch_id")
        .in("branch_id", branchIds)
        .eq("is_active", true);

      if (usersError) {
        console.error("Error fetching user counts:", usersError);
      }

      // Build metrics map
      const metricsMap: Record<string, BranchMetrics> = {};
      branchIds.forEach(id => {
        metricsMap[id] = { vehicles_count: 0, users_count: 0 };
      });

      if (vehicles) {
        vehicles.forEach(v => {
          if (v.branch_id && metricsMap[v.branch_id]) {
            metricsMap[v.branch_id].vehicles_count++;
          }
        });
      }

      if (users) {
        users.forEach(u => {
          if (u.branch_id && metricsMap[u.branch_id]) {
            metricsMap[u.branch_id].users_count++;
          }
        });
      }

      setMetrics(metricsMap);
    } catch (err) {
      console.error("Metrics error:", err);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          b.name.toLowerCase().includes(searchLower) ||
          (b.city?.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      // Active filter
      if (!showInactive && !b.is_active) return false;
      
      return true;
    });
  }, [branches, search, showInactive]);

  // Summary stats
  const totalBranches = branches.length;
  const activeBranches = branches.filter(b => b.is_active).length;
  const totalVehicles = Object.values(metrics).reduce((sum, m) => sum + m.vehicles_count, 0);
  const totalUsers = Object.values(metrics).reduce((sum, m) => sum + m.users_count, 0);

  const openCreateDialog = () => {
    setEditingBranch(null);
    setFormData({ name: "", city: "", address: "", is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({ 
      name: branch.name, 
      city: branch.city || "", 
      address: branch.address || "",
      is_active: branch.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setSaving(true);
    
    if (editingBranch) {
      const { data, error } = await supabase
        .from("branches")
        .update({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          address: formData.address.trim() || null,
        })
        .eq("id", editingBranch.id)
        .select();

      if (error) {
        console.error("Error updating branch:", error);
        toast.error(`Error al actualizar: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        setSaving(false);
        return;
      }
      
      if (!data || data.length === 0) {
        toast.error("No se actualizó ningún registro. Verifica permisos RLS.");
        setSaving(false);
        return;
      }

      toast.success("Sede actualizada");
      setDialogOpen(false);
      fetchBranches();
    } else {
      const { data, error } = await supabase
        .from("branches")
        .insert({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          address: formData.address.trim() || null,
          org_id: profile!.org_id,
          is_active: true,
        })
        .select();

      if (error) {
        console.error("Error creating branch:", error);
        toast.error(`Error al crear: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        setSaving(false);
        return;
      }
      
      if (!data || data.length === 0) {
        toast.error("No se creó la sede. Verifica permisos RLS.");
        setSaving(false);
        return;
      }

      toast.success("Sede creada");
      setDialogOpen(false);
      fetchBranches();
    }
    setSaving(false);
  };

  const confirmToggleActive = (branch: Branch) => {
    if (branch.is_active) {
      // Show confirmation for deactivation
      setDeactivatingBranch(branch);
    } else {
      // Direct activation
      toggleActive(branch);
    }
  };

  const toggleActive = async (branch: Branch) => {
    const { data, error } = await supabase
      .from("branches")
      .update({ is_active: !branch.is_active })
      .eq("id", branch.id)
      .select();

    if (error) {
      console.error("Error toggling branch:", error);
      toast.error(`Error: ${error.message}`);
      return;
    }
    
    if (!data || data.length === 0) {
      toast.error("No se actualizó el estado. Verifica permisos RLS.");
      return;
    }

    toast.success(branch.is_active ? "Sede desactivada" : "Sede activada");
    setDeactivatingBranch(null);
    fetchBranches();
  };

  if (loading) {
    return (
      <AdminLayout title="Sedes" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Sedes" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Sedes" 
      breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Sedes" }]}
      actions={
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Nueva Sede</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Sedes</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalBranches}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Activas</p>
                  <p className="text-lg sm:text-2xl font-bold">{activeBranches}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Car className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Vehículos</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalVehicles}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Usuarios</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              Mostrar inactivas
            </Label>
          </div>
        </div>

        {/* Branches List */}
        {filteredBranches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search || showInactive ? "Sin resultados" : "Sin sedes"}
            description={
              search 
                ? `No se encontraron sedes para "${search}"` 
                : "No hay sedes registradas. Crea la primera sede para comenzar."
            }
            action={!search ? { label: "Crear Sede", onClick: openCreateDialog } : undefined}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-center">Vehículos</TableHead>
                    <TableHead className="text-center">Usuarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => {
                    const branchMetrics = metrics[branch.id] || { vehicles_count: 0, users_count: 0 };
                    return (
                      <TableRow key={branch.id} className={!branch.is_active ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>{branch.city || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{branch.address || "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span>{branchMetrics.vehicles_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{branchMetrics.users_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={branch.is_active ? "default" : "secondary"}>
                            {branch.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(branch.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(branch)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmToggleActive(branch)}
                            >
                              {branch.is_active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-2 md:hidden">
              {filteredBranches.map((branch) => {
                const branchMetrics = metrics[branch.id] || { vehicles_count: 0, users_count: 0 };
                return (
                  <Card key={branch.id} className={!branch.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{branch.name}</span>
                            <Badge variant={branch.is_active ? "default" : "secondary"} className="text-xs">
                              {branch.is_active ? "Activa" : "Inactiva"}
                            </Badge>
                          </div>
                          {branch.city && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {branch.city}
                            </div>
                          )}
                          {branch.address && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{branch.address}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(branch)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-2 border-t">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-sm">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span>{branchMetrics.vehicles_count}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{branchMetrics.users_count}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => confirmToggleActive(branch)}
                        >
                          {branch.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Editar Sede" : "Nueva Sede"}</DialogTitle>
            <DialogDescription>
              {editingBranch ? "Modifica los datos de la sede." : "Ingresa los datos de la nueva sede."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre de la sede"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Ciudad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Dirección"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivatingBranch} onOpenChange={(open) => !open && setDeactivatingBranch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              ¿Desactivar sede?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de desactivar la sede <strong>{deactivatingBranch?.name}</strong>.
                </p>
                
                {deactivatingBranch && metrics[deactivatingBranch.id] && (
                  <div className="rounded-lg bg-muted p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Vehículos activos asignados:
                      </span>
                      <strong>{metrics[deactivatingBranch.id].vehicles_count}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuarios activos asignados:
                      </span>
                      <strong>{metrics[deactivatingBranch.id].users_count}</strong>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  La sede desactivada no aparecerá como opción en formularios, pero los registros existentes mantendrán su asignación.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivatingBranch && toggleActive(deactivatingBranch)}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}