import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { Upload, FileText, Image, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAudit } from "@/hooks/use-audit";
import { buildVehicleFilePath, uploadToBucket } from "@/lib/storageUpload";
import {
  getSignedUrl,
  openInNewTab,
  DEFAULT_DOWNLOAD_TTL_SECONDS,
} from "@/lib/storage";
import { DOC_TYPES } from "@/lib/docTypes";

interface Props { vehicleId: string; }

export function VehicleFilesTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const { log: auditLog } = useAudit();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ file_kind: "photo", visibility: "operations", doc_type: "", expires_at: "" });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchFiles = async () => {
    const { data } = await supabase.from("vehicle_files").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, [vehicleId]);

  const getBucket = (visibility: string) => {
    if (visibility === "sales") return "vehicle-public";
    if (visibility === "restricted") return "vehicle-restricted";
    return "vehicle-internal";
  };

  const handleDownload = async (f: any) => {
    setDownloadingId(f.id);
    try {
      const url = await getSignedUrl(
        f.storage_bucket,
        f.storage_path,
        DEFAULT_DOWNLOAD_TTL_SECONDS
      );
      openInNewTab(url);
    } catch (err: any) {
      toast.error(err?.message || "No se pudo descargar el archivo");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;
    if (form.file_kind === "document" && !form.doc_type) {
      toast.error("Selecciona el tipo de documento");
      return;
    }    
    setUploading(true);
    try {
      const bucket = getBucket(form.visibility);
      const path = buildVehicleFilePath({
        orgId: profile.org_id,
        vehicleId,
        visibility: form.visibility as "sales" | "operations" | "restricted",
        originalFileName: file.name,
      });
      
      await uploadToBucket({ bucket, path, file });
            
      const { data: fileRecord, error: dbError } = await supabase.from("vehicle_files").insert({
        org_id: profile.org_id, vehicle_id: vehicleId, storage_bucket: bucket, storage_path: path,
        file_name: file.name, mime_type: file.type, file_kind: form.file_kind, visibility: form.visibility,
        doc_type: form.file_kind === "document" ? (form.doc_type || null) : null,
        expires_at: form.file_kind === "document" ? (form.expires_at || null) : null,
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
        },
      });
      
      toast.success("Archivo subido");
      setDialogOpen(false);
      fetchFiles();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
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
                  <Select value={form.file_kind} onValueChange={(v) => setForm(f => ({ ...f, file_kind: v, doc_type: v === "photo" ? "" : f.doc_type, expires_at: v === "photo" ? "" : f.expires_at, }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="document">Documento</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidad</Label>
                  <Select value={form.visibility} onValueChange={(v) => setForm(f => ({ ...f, visibility: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Ventas</SelectItem><SelectItem value="operations">Operaciones</SelectItem><SelectItem value="restricted">Restringido</SelectItem></SelectContent></Select>
                </div>
              </div>
              {form.file_kind === "document" && (
                <div className="space-y-2">
                  <Label>Tipo de documento</Label>
                  <Select
                    value={form.doc_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, doc_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.file_kind === "document" && (
                <div className="space-y-2">
                  <Label>Vence</Label>
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
              )}
              <Input type="file" onChange={handleUpload} disabled={uploading} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {files.length === 0 ? <EmptyState icon={FileText} title="Sin archivos" description="Sube fotos o documentos del vehículo." /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => (
            <Card key={f.id}><CardContent className="py-3 flex items-center gap-3">
              {f.file_kind === "photo" ? <Image className="h-8 w-8 text-muted-foreground" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.file_name || "Archivo"}</p><p className="text-xs text-muted-foreground">{f.visibility} · {formatDate(f.created_at)}</p></div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(f)}
                disabled={downloadingId === f.id}
                aria-label="Descargar archivo"
              >
                <Download className="h-4 w-4" />
              </Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
