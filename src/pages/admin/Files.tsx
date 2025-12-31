import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { FileText, ExternalLink, Download, Image, File } from "lucide-react";

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
  vehicles?: { license_plate: string | null; brand: string; line: string | null } | null;
}

export default function AdminFiles() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [files, setFiles] = useState<VehicleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVisibility, setFilterVisibility] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");

  const fetchFiles = async () => {
    if (!profile?.org_id) return;

    const { data, error } = await supabase
      .from("vehicle_files")
      .select(`
        *,
        vehicles(license_plate, brand, line)
      `)
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching files:", error);
      toast({ title: "Error", description: "No se pudieron cargar los archivos", variant: "destructive" });
    } else {
      setFiles((data || []).map(f => ({
        ...f,
        vehicles: f.vehicles as VehicleFile["vehicles"],
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [profile?.org_id]);

  const downloadFile = async (file: VehicleFile) => {
    const { data, error } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 60);

    if (error) {
      console.error("Error creating signed URL:", error);
      toast({ title: "Error", description: "No se pudo generar el enlace de descarga", variant: "destructive" });
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const getVisibilityBadge = (visibility: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive"> = {
      sales: "default",
      operations: "secondary",
      restricted: "destructive",
    };
    return <Badge variant={colors[visibility] || "outline"}>{visibility}</Badge>;
  };

  const getKindIcon = (kind: string) => {
    return kind === "photo" ? <Image className="h-4 w-4" /> : <File className="h-4 w-4" />;
  };

  const filteredFiles = files.filter(f => {
    const matchVisibility = filterVisibility === "all" || f.visibility === filterVisibility;
    const matchKind = filterKind === "all" || f.file_kind === filterKind;
    return matchVisibility && matchKind;
  });

  // Check for files expiring in next 30 days
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringFiles = files.filter(f => {
    if (!f.expires_at) return false;
    const expDate = new Date(f.expires_at);
    return expDate <= in30Days && expDate >= today;
  });

  if (loading) {
    return (
      <AdminLayout title="Archivos" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Archivos" }]}>
        <LoadingState variant="table" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Archivos" breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Archivos" }]}>
      <div className="space-y-4">
        {expiringFiles.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ {expiringFiles.length} archivo(s) vencen en los próximos 30 días
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={filterVisibility} onValueChange={setFilterVisibility}>
            <SelectTrigger className="sm:w-40">
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
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="photo">Fotos</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredFiles.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin archivos"
            description="No hay archivos que coincidan con los filtros. Los archivos se suben desde el detalle de cada vehículo."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Visibilidad</TableHead>
                  <TableHead>Doc Type</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Subido</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file) => {
                  const isExpiring = file.expires_at && new Date(file.expires_at) <= in30Days;
                  return (
                    <TableRow key={file.id}>
                      <TableCell>{getKindIcon(file.file_kind)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {file.file_name || file.storage_path.split("/").pop()}
                      </TableCell>
                      <TableCell>
                        {file.vehicles ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => navigate(`/admin/vehicles/${file.vehicle_id}`)}
                          >
                            {file.vehicles.license_plate || file.vehicles.brand}
                          </Button>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{getVisibilityBadge(file.visibility)}</TableCell>
                      <TableCell>{file.doc_type || "-"}</TableCell>
                      <TableCell>
                        {file.expires_at ? (
                          <span className={isExpiring ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                            {formatDate(file.expires_at)}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{formatDate(file.created_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => downloadFile(file)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/vehicles/${file.vehicle_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
