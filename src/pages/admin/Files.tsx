import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { 
  FileText, ExternalLink, Download, Image, File, Search, 
  AlertTriangle, Car, Calendar, Eye, Shield, Clock 
} from "lucide-react";

// Types
interface VehicleFile {
  id: string;
  vehicle_id: string;
  file_kind: string;
  visibility: string;
  doc_type: string | null;
  file_name: string | null;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  expires_at: string | null;
  created_at: string;
  source: "vehicle";
  vehicles?: { 
    id: string;
    license_plate: string | null; 
    brand: string; 
    line: string | null;
    is_archived: boolean;
  } | null;
}

interface DealDocument {
  id: string;
  doc_type: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  sale_id: string | null;
  reservation_id: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  source: "deal";
  vehicle?: { id: string; license_plate: string | null; is_archived: boolean } | null;
  customer?: { full_name: string } | null;
}

interface ComplianceAlert {
  vehicle_id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  type: "soat" | "tecnomecanica";
  expires_at: string;
  days_until: number;
}

interface FileAlert {
  id: string;
  vehicle_id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  doc_type: string | null;
  file_name: string | null;
  expires_at: string;
  days_until: number;
}

type UnifiedFile = VehicleFile | DealDocument;

const DOC_TYPES = [
  { value: "contrato", label: "Contrato" },
  { value: "factura", label: "Factura" },
  { value: "cedula", label: "Cédula/Documento" },
  { value: "soat", label: "SOAT" },
  { value: "tecno", label: "Tecnomecánica" },
  { value: "titulo", label: "Título de Propiedad" },
  { value: "tarjeta_propiedad", label: "Tarjeta de Propiedad" },
  { value: "revision", label: "Revisión" },
  { value: "otro", label: "Otro" },
];

export default function AdminFiles() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [vehicleFiles, setVehicleFiles] = useState<VehicleFile[]>([]);
  const [dealDocuments, setDealDocuments] = useState<DealDocument[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  
  // Filters
  const [search, setSearch] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterDocType, setFilterDocType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<UnifiedFile | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [vfRes, ddRes, vcRes] = await Promise.all([
        // Vehicle files
        supabase
          .from("vehicle_files")
          .select(`
            *,
            vehicles!inner(id, license_plate, brand, line, is_archived)
          `)
          .eq("org_id", profile.org_id)
          .order("created_at", { ascending: false })
          .limit(500),
        
        // Deal documents
        supabase
          .from("deal_documents")
          .select(`
            *,
            vehicle:vehicles(id, license_plate, is_archived),
            customer:customers(full_name)
          `)
          .eq("org_id", profile.org_id)
          .order("created_at", { ascending: false })
          .limit(500),
        
        // Vehicle compliance for alerts
        supabase
          .from("vehicle_compliance")
          .select(`
            vehicle_id,
            soat_expires_at,
            tecnomecanica_expires_at,
            vehicles!inner(id, license_plate, brand, line, is_archived)
          `)
          .eq("org_id", profile.org_id),
      ]);

      if (vfRes.error) {
        console.error("Error fetching vehicle_files:", vfRes.error);
        toast({ title: "Error", description: vfRes.error.message, variant: "destructive" });
      }
      if (ddRes.error) {
        console.error("Error fetching deal_documents:", ddRes.error);
        toast({ title: "Error", description: ddRes.error.message, variant: "destructive" });
      }
      if (vcRes.error) {
        console.error("Error fetching vehicle_compliance:", vcRes.error);
      }

      // Process vehicle files
      setVehicleFiles((vfRes.data || []).map(f => ({
        ...f,
        source: "vehicle" as const,
        vehicles: f.vehicles as VehicleFile["vehicles"],
      })));

      // Process deal documents
      setDealDocuments((ddRes.data || []).map(d => ({
        ...d,
        source: "deal" as const,
        vehicle: d.vehicle as DealDocument["vehicle"],
        customer: d.customer as DealDocument["customer"],
      })));

      // Process compliance alerts (only for non-archived vehicles)
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const alerts: ComplianceAlert[] = [];
      
      for (const vc of (vcRes.data || [])) {
        const vehicle = vc.vehicles as any;
        if (!vehicle || vehicle.is_archived) continue;

        if (vc.soat_expires_at) {
          const expDate = new Date(vc.soat_expires_at);
          if (expDate <= in30Days && expDate >= today) {
            const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            alerts.push({
              vehicle_id: vc.vehicle_id,
              license_plate: vehicle.license_plate,
              brand: vehicle.brand,
              line: vehicle.line,
              type: "soat",
              expires_at: vc.soat_expires_at,
              days_until: daysUntil,
            });
          }
        }
        
        if (vc.tecnomecanica_expires_at) {
          const expDate = new Date(vc.tecnomecanica_expires_at);
          if (expDate <= in30Days && expDate >= today) {
            const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            alerts.push({
              vehicle_id: vc.vehicle_id,
              license_plate: vehicle.license_plate,
              brand: vehicle.brand,
              line: vehicle.line,
              type: "tecnomecanica",
              expires_at: vc.tecnomecanica_expires_at,
              days_until: daysUntil,
            });
          }
        }
      }
      
      // Sort alerts by days_until
      alerts.sort((a, b) => a.days_until - b.days_until);
      setComplianceAlerts(alerts);
      
    } catch (err) {
      console.error("Error in fetchData:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unified files list
  const allFiles: UnifiedFile[] = [
    ...vehicleFiles,
    ...dealDocuments,
  ];

  const filesAfterArchiveFilter = allFiles.filter((f) => {
    if (includeArchived) return true;
  
    if (f.source === "vehicle") {
      const vf = f as VehicleFile;
      return !vf.vehicles?.is_archived;
    }
  
    const dd = f as DealDocument;
    return !dd.vehicle?.is_archived;
  });

  // File alerts (vehicle_files with expires_at in next 30 days)
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const fileAlerts: FileAlert[] = vehicleFiles
  .filter(f => includeArchived || !f.vehicles?.is_archived)
  .filter(f => {
    if (!f.expires_at) return false;
    const expDate = new Date(f.expires_at);
    return expDate <= in30Days && expDate >= today;
  })
    .map(f => {
      const expDate = new Date(f.expires_at!);
      const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: f.id,
        vehicle_id: f.vehicle_id,
        license_plate: f.vehicles?.license_plate || null,
        brand: f.vehicles?.brand || "",
        line: f.vehicles?.line || null,
        doc_type: f.doc_type,
        file_name: f.file_name,
        expires_at: f.expires_at!,
        days_until: daysUntil,
      };
    })
    .sort((a, b) => a.days_until - b.days_until);

  // Filter files
  const filteredFiles = filesAfterArchiveFilter.filter(f => {
    // Source filter
    if (filterSource !== "all") {
      if (filterSource === "vehicle" && f.source !== "vehicle") return false;
      if (filterSource === "deal" && f.source !== "deal") return false;
    }
    
    // Visibility filter (only for vehicle files)
    if (filterVisibility !== "all" && f.source === "vehicle") {
      if ((f as VehicleFile).visibility !== filterVisibility) return false;
    }
    
    // Kind filter (only for vehicle files)
    if (filterKind !== "all" && f.source === "vehicle") {
      if ((f as VehicleFile).file_kind !== filterKind) return false;
    }
    
    // Doc type filter
    if (filterDocType !== "all") {
      if (f.source === "vehicle" && (f as VehicleFile).doc_type !== filterDocType) return false;
      if (f.source === "deal" && (f as DealDocument).doc_type !== filterDocType) return false;
    }
    
    // Expiring only
    if (showExpiringOnly) {
      if (f.source === "vehicle") {
        const vf = f as VehicleFile;
        if (!vf.expires_at) return false;
        const expDate = new Date(vf.expires_at);
        if (expDate > in30Days || expDate < today) return false;
      } else {
        return false; // Deal documents don't have expiration
      }
    }
    
    // Search by plate
    if (search) {
      const q = search.toLowerCase();
      if (f.source === "vehicle") {
        const vf = f as VehicleFile;
        const plate = vf.vehicles?.license_plate?.toLowerCase() || "";
        const brand = vf.vehicles?.brand?.toLowerCase() || "";
        const fileName = vf.file_name?.toLowerCase() || "";
        if (!plate.includes(q) && !brand.includes(q) && !fileName.includes(q)) return false;
      } else {
        const dd = f as DealDocument;
        const plate = dd.vehicle?.license_plate?.toLowerCase() || "";
        const customer = dd.customer?.full_name?.toLowerCase() || "";
        if (!plate.includes(q) && !customer.includes(q)) return false;
      }
    }
    
    return true;
  });

  // Sort by created_at desc
  filteredFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openPreview = async (file: UnifiedFile) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewOpen(true);
    
    try {
      const { data, error } = await supabase.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 300);

      if (error) {
        console.error("Error creating signed URL:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setPreviewUrl(null);
      } else {
        setPreviewUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error("Error in openPreview:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadFile = async (file: UnifiedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 60);

      if (error) {
        console.error("Error creating signed URL:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Error in downloadFile:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      sales: "default",
      operations: "secondary",
      restricted: "destructive",
    };
    return <Badge variant={variants[visibility] || "outline"}>{visibility}</Badge>;
  };

  const getKindIcon = (kind: string) => {
    return kind === "photo" ? <Image className="h-4 w-4" /> : <File className="h-4 w-4" />;
  };

  const getDocTypeLabel = (docType: string | null) => {
    if (!docType) return "—";
    const found = DOC_TYPES.find(t => t.value === docType);
    return found ? found.label : docType;
  };

  const getVehicleLabel = (file: UnifiedFile) => {
    if (file.source === "vehicle") {
      const vf = file as VehicleFile;
      return vf.vehicles?.license_plate || `${vf.vehicles?.brand || ""} ${vf.vehicles?.line || ""}`.trim() || "—";
    } else {
      const dd = file as DealDocument;
      return dd.vehicle?.license_plate || "—";
    }
  };

  const getVehicleId = (file: UnifiedFile) => {
    if (file.source === "vehicle") {
      return (file as VehicleFile).vehicle_id;
    } else {
      return (file as DealDocument).vehicle_id;
    }
  };

  const isImage = (file: UnifiedFile) => {
    const path = file.storage_path.toLowerCase();
    return path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".gif") || path.endsWith(".webp");
  };

  const isPdf = (file: UnifiedFile) => {
    return file.storage_path.toLowerCase().endsWith(".pdf");
  };

  const totalAlerts = complianceAlerts.length + fileAlerts.length;

  if (loading) {
    return (
      <AdminLayout title="Archivos" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Archivos" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Archivos" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Archivos" }]}>
      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files" className="gap-2">
            <FileText className="h-4 w-4" />
            Archivos ({allFiles.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="ml-1">{totalAlerts}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* FILES TAB */}
        <TabsContent value="files" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa, marca, archivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="vehicle">Vehículo</SelectItem>
                <SelectItem value="deal">Transacción</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Visibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sales">Ventas</SelectItem>
                <SelectItem value="operations">Operaciones</SelectItem>
                <SelectItem value="restricted">Restringido</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="photo">Fotos</SelectItem>
                <SelectItem value="document">Docs</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterDocType} onValueChange={setFilterDocType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Doc Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {DOC_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Switch
                id="expiring"
                checked={showExpiringOnly}
                onCheckedChange={setShowExpiringOnly}
              />
              <Label htmlFor="expiring" className="text-sm whitespace-nowrap">Vence ≤30d</Label>
              <div className="flex items-center gap-2">
              <Switch
                id="include_archived"
                checked={includeArchived}
                onCheckedChange={(v) => setIncludeArchived(!!v)}
              />
              <Label htmlFor="include_archived">Incluir archivados</Label>
            </div>
            </div>
          </div>

          {/* Files Table */}
          {filteredFiles.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin archivos"
              description="No hay archivos que coincidan con los filtros."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Visibilidad</TableHead>
                    <TableHead>Doc Type</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Subido</TableHead>
                    <TableHead className="text-right w-28">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.slice(0, 100).map((file) => {
                    const isExpiring = file.source === "vehicle" && (file as VehicleFile).expires_at && 
                      new Date((file as VehicleFile).expires_at!) <= in30Days;
                    const vehicleId = getVehicleId(file);
                    
                    return (
                      <TableRow key={`${file.source}-${file.id}`}>
                        <TableCell>
                          {file.source === "vehicle" ? getKindIcon((file as VehicleFile).file_kind) : <FileText className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {file.source === "vehicle" 
                            ? ((file as VehicleFile).file_name || file.storage_path.split("/").pop())
                            : file.storage_path.split("/").pop()
                          }
                        </TableCell>
                        <TableCell>
                          {vehicleId ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto font-mono"
                              onClick={() => navigate(`/admin/vehicles/${vehicleId}`)}
                            >
                              {getVehicleLabel(file)}
                            </Button>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={file.source === "vehicle" ? "secondary" : "outline"}>
                            {file.source === "vehicle" ? "Vehículo" : "Transacción"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {file.source === "vehicle" 
                            ? getVisibilityBadge((file as VehicleFile).visibility)
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          {file.source === "vehicle" 
                            ? getDocTypeLabel((file as VehicleFile).doc_type)
                            : getDocTypeLabel((file as DealDocument).doc_type)
                          }
                        </TableCell>
                        <TableCell>
                          {file.source === "vehicle" && (file as VehicleFile).expires_at ? (
                            <span className={isExpiring ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                              {formatDate((file as VehicleFile).expires_at!)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(file.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openPreview(file)} title="Vista previa">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => downloadFile(file)} title="Descargar">
                              <Download className="h-4 w-4" />
                            </Button>
                            {vehicleId && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => navigate(`/admin/vehicles/${vehicleId}`)}
                                title="Ir al vehículo"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredFiles.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Mostrando 100 de {filteredFiles.length} archivos. Usa los filtros para refinar.
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="space-y-6">
          {totalAlerts === 0 ? (
            <EmptyState
              icon={Shield}
              title="Sin alertas"
              description="No hay documentos ni compliance próximos a vencer en los próximos 30 días."
            />
          ) : (
            <>
              {/* Compliance Alerts */}
              {complianceAlerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Car className="h-5 w-5 text-amber-500" />
                      SOAT / Tecnomecánica por vencer ({complianceAlerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead>Días restantes</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceAlerts.map((alert, idx) => (
                            <TableRow key={`${alert.vehicle_id}-${alert.type}-${idx}`}>
                              <TableCell>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto font-mono"
                                  onClick={() => navigate(`/admin/vehicles/${alert.vehicle_id}?tab=compliance`)}
                                >
                                  {alert.license_plate || `${alert.brand} ${alert.line || ""}`.trim()}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Badge variant={alert.type === "soat" ? "default" : "secondary"}>
                                  {alert.type === "soat" ? "SOAT" : "Tecnomecánica"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-amber-600 dark:text-amber-400 font-medium">
                                {formatDate(alert.expires_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className={alert.days_until <= 7 ? "text-destructive font-bold" : "font-medium"}>
                                    {alert.days_until} día{alert.days_until !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/admin/vehicles/${alert.vehicle_id}?tab=compliance`)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Ver Compliance
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* File Expiration Alerts */}
              {fileAlerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5 text-amber-500" />
                      Documentos por vencer ({fileAlerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead>Días restantes</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fileAlerts.map((alert) => (
                            <TableRow key={alert.id}>
                              <TableCell>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto font-mono"
                                  onClick={() => navigate(`/admin/vehicles/${alert.vehicle_id}?tab=files`)}
                                >
                                  {alert.license_plate || `${alert.brand} ${alert.line || ""}`.trim()}
                                </Button>
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {alert.file_name || "—"}
                              </TableCell>
                              <TableCell>{getDocTypeLabel(alert.doc_type)}</TableCell>
                              <TableCell className="text-amber-600 dark:text-amber-400 font-medium">
                                {formatDate(alert.expires_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className={alert.days_until <= 7 ? "text-destructive font-bold" : "font-medium"}>
                                    {alert.days_until} día{alert.days_until !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/admin/vehicles/${alert.vehicle_id}?tab=files`)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Ver Archivos
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vista previa
              {previewFile && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {previewFile.source === "vehicle" 
                    ? ((previewFile as VehicleFile).file_name || previewFile.storage_path.split("/").pop())
                    : previewFile.storage_path.split("/").pop()
                  }
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingState variant="cards" />
              </div>
            ) : previewUrl ? (
              previewFile && isImage(previewFile) ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-w-full h-auto rounded-lg mx-auto"
                />
              ) : previewFile && isPdf(previewFile) ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-[70vh] rounded-lg border"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center py-12 space-y-4">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Vista previa no disponible para este tipo de archivo.</p>
                  <Button onClick={() => previewUrl && window.open(previewUrl, "_blank")}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar archivo
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <p className="text-destructive">Error al cargar la vista previa</p>
              </div>
            )}
          </div>
          {previewUrl && previewFile && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={() => window.open(previewUrl, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              {getVehicleId(previewFile) && (
                <Button 
                  variant="secondary"
                  onClick={() => {
                    setPreviewOpen(false);
                    navigate(`/admin/vehicles/${getVehicleId(previewFile)}`);
                  }}
                >
                  <Car className="h-4 w-4 mr-2" />
                  Ir al vehículo
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
