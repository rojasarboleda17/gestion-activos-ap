import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminBranches() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", city: "", address: "" });
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    if (!profile?.org_id) return;
    
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("name");

    if (error) {
      console.error("Error fetching branches:", error);
      toast({ title: "Error", description: "No se pudieron cargar las sedes", variant: "destructive" });
    } else {
      setBranches(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBranches();
  }, [profile?.org_id]);

  const openCreateDialog = () => {
    setEditingBranch(null);
    setFormData({ name: "", city: "", address: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({ 
      name: branch.name, 
      city: branch.city || "", 
      address: branch.address || "" 
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    if (editingBranch) {
      const { error } = await supabase
        .from("branches")
        .update({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          address: formData.address.trim() || null,
        })
        .eq("id", editingBranch.id);

      if (error) {
        console.error("Error updating branch:", error);
        toast({ title: "Error", description: "No se pudo actualizar la sede", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Sede actualizada" });
        setDialogOpen(false);
        fetchBranches();
      }
    } else {
      const { error } = await supabase
        .from("branches")
        .insert({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          address: formData.address.trim() || null,
          org_id: profile!.org_id,
        });

      if (error) {
        console.error("Error creating branch:", error);
        toast({ title: "Error", description: "No se pudo crear la sede", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Sede creada" });
        setDialogOpen(false);
        fetchBranches();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (branch: Branch) => {
    const { error } = await supabase
      .from("branches")
      .update({ is_active: !branch.is_active })
      .eq("id", branch.id);

    if (error) {
      console.error("Error toggling branch:", error);
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    } else {
      toast({ title: "Éxito", description: branch.is_active ? "Sede desactivada" : "Sede activada" });
      fetchBranches();
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Sedes" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Sedes" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Sedes" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Sedes" }]}
      actions={
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Sede
        </Button>
      }
    >
      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin sedes"
          description="No hay sedes registradas. Crea la primera sede para comenzar."
          action={{ label: "Crear Sede", onClick: openCreateDialog }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.city || "-"}</TableCell>
                  <TableCell>{branch.address || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(branch)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(branch)}
                    >
                      {branch.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Editar Sede" : "Nueva Sede"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
