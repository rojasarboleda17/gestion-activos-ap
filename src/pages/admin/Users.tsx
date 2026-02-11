import { useState, useEffect, useMemo, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Users, Shield, Settings, Search, X, Edit, Key, AlertTriangle, Plus, Trash2, Info } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { logger } from "@/lib/logger";

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

interface UserPermissionOverride {
  user_id: string;
  permission_key: string;
  allowed: boolean;
}

const ROLES = ["admin", "accounting", "operations", "sales", "vendor"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  accounting: "Contabilidad",
  operations: "Operaciones",
  sales: "Ventas",
  vendor: "Proveedor",
};

export default function AdminUsers() {
  const { profile: currentProfile } = useAuth();
  
  // Data states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [rlsError, setRlsError] = useState<string | null>(null);
  
  // Filter states
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  
  // UI states
  const [selectedRole, setSelectedRole] = useState("sales");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ role: "", branch_id: "", is_active: true });
  const [saving, setSaving] = useState(false);
  
  // Permission catalog states
  const [newPermKey, setNewPermKey] = useState("");
  const [newPermDesc, setNewPermDesc] = useState("");
  const [addingPerm, setAddingPerm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentProfile?.org_id) return;
    setLoading(true);
    setRlsError(null);

    try {
      const [profilesRes, branchesRes, permissionsRes, rolePermsRes, overridesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("org_id", currentProfile.org_id).order("full_name"),
        supabase.from("branches").select("id, name").eq("org_id", currentProfile.org_id).eq("is_active", true),
        supabase.from("permissions").select("*").order("key"),
        supabase.from("role_permissions").select("*"),
        supabase.from("user_permission_overrides").select("*"),
      ]);

      if (profilesRes.error) {
        logger.error("Error fetching profiles:", profilesRes.error);
        setRlsError(`Error al cargar perfiles: ${profilesRes.error.message}. Verifica las políticas RLS para admin.`);
      }
      if (branchesRes.error) logger.error("Error fetching branches:", branchesRes.error);
      if (permissionsRes.error) logger.error("Error fetching permissions:", permissionsRes.error);
      if (rolePermsRes.error) logger.error("Error fetching role permissions:", rolePermsRes.error);
      if (overridesRes.error) logger.error("Error fetching overrides:", overridesRes.error);

      setProfiles(profilesRes.data || []);
      setBranches(branchesRes.data || []);
      setPermissions(permissionsRes.data || []);
      setRolePermissions(rolePermsRes.data || []);
      setUserOverrides(overridesRes.data || []);
    } catch (err: unknown) {
      logger.error("Fetch error:", err);
      setRlsError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (p.full_name?.toLowerCase().includes(searchLower)) ||
          (p.phone?.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      // Role filter
      if (filterRole !== "all" && p.role !== filterRole) return false;
      
      // Branch filter
      if (filterBranch !== "all") {
        if (filterBranch === "none" && p.branch_id !== null) return false;
        if (filterBranch !== "none" && p.branch_id !== filterBranch) return false;
      }
      
      // Active filter
      if (filterActive !== "all") {
        if (filterActive === "active" && !p.is_active) return false;
        if (filterActive === "inactive" && p.is_active) return false;
      }
      
      return true;
    });
  }, [profiles, search, filterRole, filterBranch, filterActive]);

  // Open edit modal
  const openEditUser = (user: Profile) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      branch_id: user.branch_id || "",
      is_active: user.is_active,
    });
  };

  // Save user changes
  const saveUser = async () => {
    if (!editingUser) return;
    
    // Validations
    if (editingUser.id === currentProfile?.id) {
      if (editingUser.role === "admin" && editForm.role !== "admin") {
        toast.error("No puedes quitarte el rol de administrador a ti mismo");
        return;
      }
      if (!editForm.is_active) {
        toast.error("No puedes desactivar tu propio usuario");
        return;
      }
    }
    
    setSaving(true);
    
    const updates: Partial<Profile> = {
      role: editForm.role,
      branch_id: editForm.branch_id || null,
      is_active: editForm.is_active,
    };
    
    const { data, error, count } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", editingUser.id)
      .select();

    setSaving(false);

    if (error) {
      logger.error("Error updating profile:", error);
      toast.error(`Error al actualizar: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
      return;
    }
    
    if (!data || data.length === 0) {
      toast.error("No se actualizó ningún registro. Verifica permisos RLS.");
      return;
    }

    toast.success("Usuario actualizado correctamente");
    setEditingUser(null);
    fetchData();
  };

  // Toggle role permission
  const toggleRolePermission = async (role: string, permissionKey: string, hasPermission: boolean) => {
    if (hasPermission) {
      const { error, count } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", role)
        .eq("permission_key", permissionKey);

      if (error) {
        toast.error(`Error al quitar permiso: ${error.message}`);
        return;
      }
      toast.success("Permiso removido del rol");
    } else {
      const { error, data } = await supabase
        .from("role_permissions")
        .insert({ role, permission_key: permissionKey })
        .select();

      if (error) {
        toast.error(`Error al agregar permiso: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        toast.error("No se agregó el permiso. Verifica permisos RLS.");
        return;
      }
      toast.success("Permiso agregado al rol");
    }
    fetchData();
  };

  // User permission override
  const toggleUserOverride = async (userId: string, permissionKey: string, currentState: "inherited" | "allowed" | "denied") => {
    // Cycle: inherited -> allowed -> denied -> inherited
    if (currentState === "inherited") {
      // Set to allowed
      const { error } = await supabase
        .from("user_permission_overrides")
        .upsert({ user_id: userId, permission_key: permissionKey, allowed: true });
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
    } else if (currentState === "allowed") {
      // Set to denied
      const { error } = await supabase
        .from("user_permission_overrides")
        .upsert({ user_id: userId, permission_key: permissionKey, allowed: false });
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
    } else {
      // Remove override (back to inherited)
      const { error } = await supabase
        .from("user_permission_overrides")
        .delete()
        .eq("user_id", userId)
        .eq("permission_key", permissionKey);
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
    }
    toast.success("Permiso actualizado");
    fetchData();
  };

  // Get user's effective permission state
  const getUserPermissionState = (userId: string, userRole: string, permissionKey: string): "inherited" | "allowed" | "denied" => {
    const override = userOverrides.find(o => o.user_id === userId && o.permission_key === permissionKey);
    if (override) {
      return override.allowed ? "allowed" : "denied";
    }
    return "inherited";
  };

  // Check if role has permission
  const roleHasPermission = (role: string, permissionKey: string) => {
    if (role === "admin") return true;
    return rolePermissions.some(rp => rp.role === role && rp.permission_key === permissionKey);
  };

  // Add new permission
  const addPermission = async () => {
    if (!newPermKey.trim()) {
      toast.error("La clave del permiso es requerida");
      return;
    }
    
    setAddingPerm(true);
    
    const { error, data } = await supabase
      .from("permissions")
      .insert({ key: newPermKey.trim(), description: newPermDesc.trim() || null })
      .select();

    setAddingPerm(false);

    if (error) {
      toast.error(`Error al crear permiso: ${error.message}`);
      return;
    }
    
    if (!data || data.length === 0) {
      toast.error("No se creó el permiso. Verifica permisos RLS.");
      return;
    }

    toast.success("Permiso creado");
    setNewPermKey("");
    setNewPermDesc("");
    fetchData();
  };

  // Delete permission
  const deletePermission = async (key: string) => {
    const { error } = await supabase
      .from("permissions")
      .delete()
      .eq("key", key);

    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
      return;
    }
    toast.success("Permiso eliminado");
    fetchData();
  };

  // Get branch name
  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "-";
    return branches.find(b => b.id === branchId)?.name || "-";
  };

  if (loading) {
    return (
      <AdminLayout title="Usuarios" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Usuarios" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Usuarios" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Usuarios" }]}>
      {rlsError && (
        <Card className="mb-4 border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{rlsError}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto gap-1 min-w-max">
            <TabsTrigger value="users" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="role-permissions" className="gap-2 text-xs sm:text-sm">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permisos por Rol</span>
            </TabsTrigger>
            <TabsTrigger value="permission-catalog" className="gap-2 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Catálogo</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* === USERS TAB === */}
        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
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
            
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role] || role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Sede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                <SelectItem value="none">Sin sede</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info card */}
          <Card className="bg-muted/50">
            <CardContent className="flex items-start gap-3 py-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Solo puedes gestionar usuarios que ya se registraron en el sistema (Auth). 
                Para agregar un nuevo usuario, pídele que se registre primero y luego actívalo aquí asignándole rol y sede.
              </p>
            </CardContent>
          </Card>

          {filteredProfiles.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search || filterRole !== "all" || filterBranch !== "all" || filterActive !== "all" ? "Sin resultados" : "Sin usuarios"}
              description={search ? `No se encontraron usuarios para "${search}"` : "No hay usuarios que coincidan con los filtros."}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.full_name || "Sin nombre"}
                            {p.id === currentProfile?.id && (
                              <Badge variant="outline" className="text-xs">Tú</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{p.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                            {ROLE_LABELS[p.role] || p.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{getBranchName(p.branch_id)}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? "default" : "destructive"}>
                            {p.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(p.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditUser(p)} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setPermissionsUser(p)} title="Permisos">
                              <Key className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-2 md:hidden">
                {filteredProfiles.map((p) => (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{p.full_name || "Sin nombre"}</span>
                          {p.id === currentProfile?.id && (
                            <Badge variant="outline" className="text-xs shrink-0">Tú</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.phone || "-"}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUser(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPermissionsUser(p)}>
                          <Key className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={p.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {ROLE_LABELS[p.role] || p.role}
                      </Badge>
                      <Badge variant={p.is_active ? "outline" : "destructive"} className="text-xs">
                        {p.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                      {p.branch_id && (
                        <span className="text-xs text-muted-foreground">{getBranchName(p.branch_id)}</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* === ROLE PERMISSIONS TAB === */}
        <TabsContent value="role-permissions" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium shrink-0">Rol:</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r !== "admin").map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role] || role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              El rol Admin tiene todos los permisos automáticamente.
            </p>
          </div>

          {permissions.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Sin permisos definidos"
              description="No hay permisos configurados. Ve al Catálogo para crear permisos."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permiso</TableHead>
                    <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                    <TableHead className="w-24 text-center">Habilitado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => {
                    const hasPermission = roleHasPermission(selectedRole, perm.key);
                    return (
                      <TableRow key={perm.key}>
                        <TableCell>
                          <span className="font-mono text-xs sm:text-sm">{perm.key}</span>
                          <p className="text-xs text-muted-foreground sm:hidden mt-0.5">{perm.description || "-"}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {perm.description || "-"}
                        </TableCell>
                        <TableCell className="text-center">
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
            </Card>
          )}
        </TabsContent>

        {/* === PERMISSION CATALOG TAB === */}
        <TabsContent value="permission-catalog" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agregar Permiso</CardTitle>
              <CardDescription>Crea nuevos permisos para asignar a roles y usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Clave (ej: vehicles.create)"
                  value={newPermKey}
                  onChange={(e) => setNewPermKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Descripción (opcional)"
                  value={newPermDesc}
                  onChange={(e) => setNewPermDesc(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addPermission} disabled={addingPerm || !newPermKey.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardContent>
          </Card>

          {permissions.length === 0 ? (
            <EmptyState
              icon={Settings}
              title="Sin permisos"
              description="Aún no hay permisos definidos en el sistema."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clave</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-20">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.key}>
                      <TableCell className="font-mono text-sm">{perm.key}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{perm.description || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deletePermission(perm.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              {editingUser?.full_name || "Usuario"}
              {editingUser?.id === currentProfile?.id && " (Tú)"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v })}
                disabled={editingUser?.id === currentProfile?.id && editingUser?.role === "admin"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role] || role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingUser?.id === currentProfile?.id && editingUser?.role === "admin" && (
                <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol de admin.</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Sede</Label>
              <Select
                value={editForm.branch_id || "none"}
                onValueChange={(v) => setEditForm({ ...editForm, branch_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sede asignada</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Estado</Label>
                <p className="text-xs text-muted-foreground">Usuario activo en el sistema</p>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                disabled={editingUser?.id === currentProfile?.id}
              />
            </div>
            {editingUser?.id === currentProfile?.id && (
              <p className="text-xs text-muted-foreground">No puedes desactivarte a ti mismo.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={saveUser} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Permissions Sheet */}
      <Sheet open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Permisos de Usuario</SheetTitle>
            <SheetDescription>
              {permissionsUser?.full_name || "Usuario"} ({ROLE_LABELS[permissionsUser?.role || ""] || permissionsUser?.role})
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Heredado:</strong> Permiso según el rol base. 
                    <strong className="text-success ml-2">Permitido:</strong> Override que concede el permiso. 
                    <strong className="text-destructive ml-2">Denegado:</strong> Override que niega el permiso.
                  </p>
                </CardContent>
              </Card>

              {permissionsUser?.role === "admin" ? (
                <Card className="bg-success/10 border-success/30">
                  <CardContent className="py-4 text-center">
                    <Shield className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="text-sm font-medium">Este usuario es Administrador</p>
                    <p className="text-xs text-muted-foreground mt-1">Tiene todos los permisos automáticamente.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => {
                    const state = getUserPermissionState(permissionsUser?.id || "", permissionsUser?.role || "", perm.key);
                    const roleHas = roleHasPermission(permissionsUser?.role || "", perm.key);
                    
                    let effectiveAccess = roleHas;
                    if (state === "allowed") effectiveAccess = true;
                    if (state === "denied") effectiveAccess = false;
                    
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs sm:text-sm truncate">{perm.key}</p>
                          <p className="text-xs text-muted-foreground truncate">{perm.description || "-"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {state === "inherited" && (
                            <Badge variant={roleHas ? "secondary" : "outline"} className="text-xs">
                              {roleHas ? "Rol" : "No"}
                            </Badge>
                          )}
                          {state === "allowed" && (
                            <Badge className="bg-success text-success-foreground text-xs">Permitido</Badge>
                          )}
                          {state === "denied" && (
                            <Badge variant="destructive" className="text-xs">Denegado</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleUserOverride(permissionsUser?.id || "", perm.key, state)}
                          >
                            Cambiar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}