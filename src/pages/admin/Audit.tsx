import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { ClipboardList, Eye } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_id: string | null;
  payload: Json;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export default function AdminAudit() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchLogs = async () => {
    if (!profile?.org_id) return;

    let query = supabase
      .from("audit_log")
      .select(`
        *,
        profiles:actor_id(full_name)
      `)
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filterAction !== "all") {
      query = query.eq("action", filterAction);
    }
    if (filterEntity !== "all") {
      query = query.eq("entity", filterEntity);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
      toast({ title: "Error", description: "No se pudo cargar el log de auditoría", variant: "destructive" });
    } else {
      setLogs((data || []).map(l => ({
        ...l,
        profiles: l.profiles as AuditLog["profiles"],
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [profile?.org_id, filterAction, filterEntity, page]);

  // Get unique actions and entities for filters
  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueEntities = [...new Set(logs.map(l => l.entity))];

  const getActionBadge = (action: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      create: "default",
      update: "secondary",
      delete: "destructive",
    };
    return <Badge variant={colors[action] || "outline"}>{action}</Badge>;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.entity.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      log.entity_id?.toLowerCase().includes(search) ||
      log.profiles?.full_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <AdminLayout title="Auditoría" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Auditoría" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Auditoría" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Auditoría" }]}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:w-64"
          />
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">create</SelectItem>
              <SelectItem value="update">update</SelectItem>
              <SelectItem value="delete">delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {uniqueEntities.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin registros"
            description="No hay registros de auditoría que coincidan con los filtros."
          />
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>ID Entidad</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{log.entity}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[150px] truncate">
                        {log.entity_id || "-"}
                      </TableCell>
                      <TableCell>{log.profiles?.full_name || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} ({filteredLogs.length} registros)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < pageSize}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de Auditoría</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>
                    <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acción:</span>
                    <p>{getActionBadge(selectedLog.action)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Entidad:</span>
                    <p className="font-medium">{selectedLog.entity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID Entidad:</span>
                    <p className="font-mono text-xs">{selectedLog.entity_id || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usuario:</span>
                    <p className="font-medium">{selectedLog.profiles?.full_name || "Sistema"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actor ID:</span>
                    <p className="font-mono text-xs">{selectedLog.actor_id || "-"}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Payload:</span>
                  <ScrollArea className="h-[300px] mt-2">
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
