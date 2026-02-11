import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ClipboardList, Eye, Search, Calendar as CalendarIcon, 
  RefreshCw, User, Activity, Database 
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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

interface Profile {
  id: string;
  full_name: string | null;
}

// Known actions for filter
const ACTIONS = [
  { value: "stage_change", label: "Cambio de estado" },
  { value: "work_order_create", label: "Crear orden" },
  { value: "work_order_close", label: "Cerrar orden" },
  { value: "work_order_item_status", label: "Estado de ítem" },
  { value: "expense_create", label: "Crear gasto" },
  { value: "reservation_create", label: "Crear reserva" },
  { value: "reservation_cancel", label: "Cancelar reserva" },
  { value: "reservation_convert", label: "Convertir reserva" },
  { value: "sale_create", label: "Crear venta" },
  { value: "sale_void", label: "Anular venta" },
  { value: "file_upload", label: "Subir archivo" },
  { value: "file_delete", label: "Eliminar archivo" },
  { value: "payment_create", label: "Crear pago" },
  { value: "customer_create", label: "Crear cliente" },
  { value: "customer_update", label: "Actualizar cliente" },
];

// Known entities
const ENTITIES = [
  { value: "vehicle", label: "Vehículo" },
  { value: "work_order", label: "Orden de trabajo" },
  { value: "work_order_item", label: "Ítem de orden" },
  { value: "vehicle_expense", label: "Gasto vehículo" },
  { value: "reservation", label: "Reserva" },
  { value: "sale", label: "Venta" },
  { value: "sale_payment", label: "Pago" },
  { value: "vehicle_file", label: "Archivo vehículo" },
  { value: "deal_document", label: "Documento" },
  { value: "customer", label: "Cliente" },
];

export default function AdminAudit() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Filters
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  
  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;
  
  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      // Fetch profiles for actor filter
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      
      setProfiles(profilesData || []);

      // Build query
      let query = supabase
        .from("audit_log")
        .select(`
          *,
          profiles:actor_id(full_name)
        `)
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }
      if (filterEntity !== "all") {
        query = query.eq("entity", filterEntity);
      }
      if (filterActor !== "all") {
        query = query.eq("actor_id", filterActor);
      }
      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.error("Error fetching audit logs:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setLogs((data || []).map(l => ({
          ...l,
          profiles: l.profiles as AuditLog["profiles"],
        })));
      }
    } catch (err) {
      logger.error("Error in fetchData:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, filterAction, filterEntity, filterActor, dateFrom, dateTo, page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetFilters = () => {
    setFilterAction("all");
    setFilterEntity("all");
    setFilterActor("all");
    setSearchTerm("");
    setDateFrom(subDays(new Date(), 7));
    setDateTo(new Date());
    setPage(0);
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      stage_change: "default",
      work_order_create: "default",
      work_order_close: "secondary",
      work_order_item_status: "outline",
      expense_create: "secondary",
      reservation_create: "default",
      reservation_cancel: "destructive",
      reservation_convert: "default",
      sale_create: "default",
      sale_void: "destructive",
      file_upload: "outline",
      file_delete: "destructive",
      payment_create: "secondary",
      customer_create: "default",
      customer_update: "outline",
    };
    const label = ACTIONS.find(a => a.value === action)?.label || action;
    return <Badge variant={variants[action] || "outline"}>{label}</Badge>;
  };

  const getEntityLabel = (entity: string) => {
    return ENTITIES.find(e => e.value === entity)?.label || entity;
  };

  // Text search filter
  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.entity.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      log.entity_id?.toLowerCase().includes(search) ||
      log.profiles?.full_name?.toLowerCase().includes(search) ||
      JSON.stringify(log.payload).toLowerCase().includes(search)
    );
  });

  // Stats
  const stats = {
    total: filteredLogs.length,
    actions: [...new Set(filteredLogs.map(l => l.action))].length,
    actors: [...new Set(filteredLogs.map(l => l.actor_id).filter(Boolean))].length,
  };

  if (loading && logs.length === 0) {
    return (
      <AdminLayout title="Auditoría" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Auditoría" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Auditoría" breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Auditoría" }]}>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Registros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.actions}</p>
                  <p className="text-xs text-muted-foreground">Tipos de acción</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.actors}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar en registros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {ACTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setPage(0); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  {ENTITIES.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterActor} onValueChange={(v) => { setFilterActor(v); setPage(0); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || "Sin nombre"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Desde:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-32 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => { setDateFrom(d); setPage(0); }}
                      locale={es}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Hasta:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-32 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => { setDateTo(d); setPage(0); }}
                      locale={es}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
              
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                {loading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin registros"
            description="No hay registros de auditoría que coincidan con los filtros."
          />
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead className="max-w-[150px]">ID Entidad</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right w-20">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{getEntityLabel(log.entity)}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[150px] truncate">
                        {log.entity_id ? log.entity_id.substring(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell>{log.profiles?.full_name || "Sistema"}</TableCell>
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

            {/* Pagination */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} · {filteredLogs.length} registros
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
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Detalle de Auditoría
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>
                    <p className="font-medium">
                      {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acción:</span>
                    <p>{getActionBadge(selectedLog.action)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Entidad:</span>
                    <p className="font-medium">{getEntityLabel(selectedLog.entity)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID Entidad:</span>
                    <p className="font-mono text-xs break-all">{selectedLog.entity_id || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usuario:</span>
                    <p className="font-medium">{selectedLog.profiles?.full_name || "Sistema"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actor ID:</span>
                    <p className="font-mono text-xs break-all">{selectedLog.actor_id || "—"}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Payload:</span>
                  <ScrollArea className="h-[300px] mt-2">
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
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
