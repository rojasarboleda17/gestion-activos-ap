import { useState, useEffect, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { Upload, FileText, Image, Download, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAudit } from "@/hooks/use-audit";

type FileFilter = "all" | "expired" | "upcoming";

const UPCOMING_DAYS = 30;

interface Props {
  vehicleId: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onCollectPayload?: (collector: (() => Promise<void>) | null) => void;
}

export function VehicleFilesTab({ vehicleId, onDirtyChange, onCollectPayload }: Props) {
  const { profile } = useAuth();
  const { log: auditLog } = useAudit();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Tables<"vehicle_files">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = useState<Tables<"document_types">[]>([]);
  const [activeFilter, setActiveFilter] = useState<FileFilter>("all");
  const [form, setForm] = useState({ file_kind: "photo", visibility: "operations", doc_type: "", doc_type_other: "", expires_at: "" });

  const normalizeDate = (value: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const getFileStatus = (expiresAt: string | null) => {
    const expiresDate = normalizeDate(expiresAt);
    if (!expiresDate) return "none";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiresDate < today) return "expired";

    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(today.getDate() + UPCOMING_DAYS);

    if (expiresDate <= upcomingLimit) return "upcoming";

    return "ok";
  };

  const getDocumentLabel = (file: Tables<"vehicle_files">) => {
    if (file.doc_type === "otro") return file.doc_type_other || "Otro";
    if (!file.doc_type) return "Sin tipo";
    return documentTypes.find((docType) => docType.code === file.doc_type)?.label || file.doc_type;
  };

  const filteredFiles = files.filter((file) => {
    const status = getFileStatus(file.expires_at);
    if (activeFilter === "expired") return status === "expired";
    if (activeFilter === "upcoming") return status === "upcoming";
    return true;
  });

  const criticalCount = files.filter((file) => {
    const status = getFileStatus(file.expires_at);
    return status === "expired" || status === "upcoming";
  }).length;

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase.from("vehicle_files").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    onDirtyChange?.(false);
    onCollectPayload?.(null);
    return () => onCollectPayload?.(null);
  }, [onCollectPayload, onDirtyChange]);


  useEffect(() => {
    const fetchDocumentTypes = async () => {
      const { data } = await supabase
        .from("document_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      setDocumentTypes(data || []);
    };

    fetchDocumentTypes();
  }, []);

  const getBucket = (visibility: string) => {
    if (visibility === "sales") return "vehicle-public";
    if (visibility === "restricted") return "vehicle-restricted";
    return "vehicle-internal";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;
    if (form.doc_type === "otro" && !form.doc_type_other.trim()) {
      toast.error("Debes especificar el tipo documental en \"Otro\"");
      return;
    }
    setUploading(true);
    try {
      const bucket = getBucket(form.visibility);
      const path = `${profile.org_id}/vehicle/${vehicleId}/${form.visibility}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: fileRecord, error: dbError } = await supabase.from("vehicle_files").insert({
        org_id: profile.org_id, vehicle_id: vehicleId, storage_bucket: bucket, storage_path: path,
        file_name: file.name, mime_type: file.type, file_kind: form.file_kind, visibility: form.visibility,
        doc_type: form.doc_type || null,
        doc_type_other: form.doc_type === "otro" ? form.doc_type_other.trim() || null : null,
        expires_at: form.expires_at || null,
        uploaded_by: profile.id,
      }).select("id").single();
      if (dbError) throw dbError;
      
      // Audit log
      auditLog({
        action: "file_upload",
        entity: "vehicle_file",
        entity_id: fileRecord?.id,
        payload: {
          vehicle_id: vehicleId,
          file_name: file.name,
          file_kind: form.file_kind,
          visibility: form.visibility,
          doc_type: form.doc_type || null,
          doc_type_other: form.doc_type === "otro" ? form.doc_type_other.trim() || null : null,
        },
      });
      
      toast.success("Archivo subido");
      setDialogOpen(false);
      fetchFiles();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
    finally { setUploading(false); }
  };

  const handleDownload = async (file: Tables<"vehicle_files">) => {
    try {
      const { data, error } = await supabase.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 60);

      if (error || !data?.signedUrl) {
        throw error || new Error("No se pudo generar URL de descarga");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      toast.success("Descarga iniciada");
      fetchFiles();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (file: Tables<"vehicle_files">) => {
    setDeletingFileId(file.id);
    try {
      const { error: storageError } = await supabase.storage.from(file.storage_bucket).remove([file.storage_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("vehicle_files").delete().eq("id", file.id);
      if (dbError) throw dbError;

      auditLog({
        action: "file_delete",
        entity: "vehicle_file",
        entity_id: file.id,
        payload: {
          vehicle_id: vehicleId,
          file_id: file.id,
          file_name: file.file_name,
          storage_bucket: file.storage_bucket,
          storage_path: file.storage_path,
          visibility: file.visibility,
        },
      });

      toast.success("Archivo eliminado");
      fetchFiles();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingFileId(null);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Upload className="h-4 w-4 mr-1" /> Subir Archivo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Subir Archivo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.file_kind} onValueChange={(v) => setForm(f => ({ ...f, file_kind: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="document">Documento</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidad</Label>
                  <Select value={form.visibility} onValueChange={(v) => setForm(f => ({ ...f, visibility: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Ventas</SelectItem><SelectItem value="operations">Operaciones</SelectItem><SelectItem value="restricted">Restringido</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select
                  value={form.doc_type || "none"}
                  onValueChange={(value) => setForm((f) => ({
                    ...f,
                    doc_type: value === "none" ? "" : value,
                    doc_type_other: value === "otro" ? f.doc_type_other : "",
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin tipo</SelectItem>
                    {documentTypes.map((docType) => (
                      <SelectItem key={docType.code} value={docType.code}>
                        {docType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.doc_type === "otro" && (
                <div className="space-y-2">
                  <Label>Especificar documento</Label>
                  <Input
                    value={form.doc_type_other}
                    onChange={(e) => setForm((f) => ({ ...f, doc_type_other: e.target.value }))}
                    placeholder="Describe el tipo documental"
                  />
                </div>
              )}
              <div className="space-y-2"><Label>Vence</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
              <Input type="file" onChange={handleUpload} disabled={uploading} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{files.length}</span> · Críticos (vencidos/próximos): <span className="font-medium text-foreground">{criticalCount}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant={activeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveFilter("all")}>Todos</Button>
          <Button variant={activeFilter === "expired" ? "default" : "outline"} size="sm" onClick={() => setActiveFilter("expired")}>Vencidos</Button>
          <Button variant={activeFilter === "upcoming" ? "default" : "outline"} size="sm" onClick={() => setActiveFilter("upcoming")}>Próximos a vencer</Button>
        </div>
      </div>
      {filteredFiles.length === 0 ? <EmptyState icon={FileText} title="Sin archivos" description="Sube fotos o documentos del vehículo." /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredFiles.map((f) => (
            <Card key={f.id}><CardContent className="py-3 flex items-center gap-3">
              {f.file_kind === "photo" ? <Image className="h-8 w-8 text-muted-foreground" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium truncate">{f.file_name || "Archivo"}</p>
                <p className="text-xs text-muted-foreground">Tipo documental: {getDocumentLabel(f)}</p>
                <p className="text-xs text-muted-foreground">Vencimiento: {f.expires_at ? formatDate(f.expires_at) : "Sin vencimiento"}</p>
                <p className="text-xs text-muted-foreground">Visibilidad: {f.visibility}</p>
                <p className="text-xs text-muted-foreground">Fecha: {formatDate(f.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleDownload(f)} title="Descargar">
                  <Download className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Eliminar" disabled={deletingFileId === f.id}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará el archivo del almacenamiento y su registro.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(f)} disabled={deletingFileId === f.id}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
