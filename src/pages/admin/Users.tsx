import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, Settings } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  phone: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Permission {
  key: string;
  description: string | null;
}

interface RolePermission {
  role: string;
  permission_key: string;
}

const ROLES = ["admin", "accounting", "operations", "sales", "vendor"];

export default function AdminUsers() {
  const { profile: currentProfile } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("sales");
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  const fetchData = async () => {
    if (!currentProfile?.org_id) return;

    const [profilesRes, branchesRes, permissionsRes, rolePermsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", currentProfile.org_id).order("full_name"),
      supabase.from("branches").select("id, name").eq("org_id", currentProfile.org_id),
      supabase.from("permissions").select("*").order("key"),
      supabase.from("role_permissions").select("*"),
    ]);

    if (profilesRes.error) console.error("Error fetching profiles:", profilesRes.error);
    if (branchesRes.error) console.error("Error fetching branches:", branchesRes.error);
    if (permissionsRes.error) console.error("Error fetching permissions:", permissionsRes.error);
    if (rolePermsRes.error) console.error("Error fetching role permissions:", rolePermsRes.error);

    setProfiles(profilesRes.data || []);
    setBranches(branchesRes.data || []);
    setPermissions(permissionsRes.data || []);
    setRolePermissions(rolePermsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentProfile?.org_id]);

  const updateProfile = async (profileId: string, updates: Partial<Profile>) => {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profileId);

    if (error) {
      console.error("Error updating profile:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar el usuario. Verifica permisos RLS.", 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Éxito", description: "Usuario actualizado" });
      fetchData();
    }
  };

  const toggleRolePermission = async (role: string, permissionKey: string, hasPermission: boolean) => {
    if (hasPermission) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", role)
        .eq("permission_key", permissionKey);

      if (error) {
        console.error("Error removing permission:", error);
        toast({ title: "Error", description: "No se pudo quitar el permiso", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Permiso removido" });
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .insert({ role, permission_key: permissionKey });

      if (error) {
        console.error("Error adding permission:", error);
        toast({ title: "Error", description: "No se pudo agregar el permiso", variant: "destructive" });
      } else {
        toast({ title: "Éxito", description: "Permiso agregado" });
        fetchData();
      }
    }
  };

  const roleHasPermission = (role: string, permissionKey: string) => {
    return rolePermissions.some(rp => rp.role === role && rp.permission_key === permissionKey);
  };

  if (loading) {
    return (
      <AdminLayout title="Usuarios" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Usuarios" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Usuarios" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Usuarios" }]}>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-4 w-4" />
            Permisos por Rol
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {profiles.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin usuarios"
              description="No hay usuarios registrados en esta organización."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.full_name || "Sin nombre"}
                        {p.id === currentProfile?.id && (
                          <Badge variant="outline" className="ml-2">Tú</Badge>
                        )}
                      </TableCell>
                      <TableCell>{p.phone || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={p.role}
                          onValueChange={(value) => updateProfile(p.id, { role: value })}
                          disabled={p.id === currentProfile?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.branch_id || "none"}
                          onValueChange={(value) => updateProfile(p.id, { branch_id: value === "none" ? null : value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Sin sede" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin sede</SelectItem>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(checked) => updateProfile(p.id, { is_active: checked })}
                          disabled={p.id === currentProfile?.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Seleccionar Rol:</span>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r !== "admin").map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">(Admin tiene todos los permisos)</span>
            </div>

            {permissions.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="Sin permisos definidos"
                description="No hay permisos configurados en el sistema."
              />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permiso</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-24">Habilitado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map((perm) => {
                      const hasPermission = roleHasPermission(selectedRole, perm.key);
                      return (
                        <TableRow key={perm.key}>
                          <TableCell className="font-mono text-sm">{perm.key}</TableCell>
                          <TableCell>{perm.description || "-"}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={hasPermission}
                              onCheckedChange={() => toggleRolePermission(selectedRole, perm.key, hasPermission)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
