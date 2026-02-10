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
import { Upload, FileText, Image, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAudit } from "@/hooks/use-audit";

interface Props { vehicleId: string; }

export function VehicleFilesTab({ vehicleId }: Props) {
  const { profile } = useAuth();
  const { log: auditLog } = useAudit();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Tables<"vehicle_files">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ file_kind: "photo", visibility: "operations", doc_type: "", expires_at: "" });

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase.from("vehicle_files").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const getBucket = (visibility: string) => {
    if (visibility === "sales") return "vehicle-public";
    if (visibility === "restricted") return "vehicle-restricted";
    return "vehicle-internal";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;
    setUploading(true);
    try {
      const bucket = getBucket(form.visibility);
      const path = `${profile.org_id}/vehicle/${vehicleId}/${form.visibility}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: fileRecord, error: dbError } = await supabase.from("vehicle_files").insert({
        org_id: profile.org_id, vehicle_id: vehicleId, storage_bucket: bucket, storage_path: path,
        file_name: file.name, mime_type: file.type, file_kind: form.file_kind, visibility: form.visibility,
        doc_type: form.doc_type || null, expires_at: form.expires_at || null, uploaded_by: profile.id,
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
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
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
                  <Select value={form.file_kind} onValueChange={(v) => setForm(f => ({ ...f, file_kind: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="document">Documento</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidad</Label>
                  <Select value={form.visibility} onValueChange={(v) => setForm(f => ({ ...f, visibility: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Ventas</SelectItem><SelectItem value="operations">Operaciones</SelectItem><SelectItem value="restricted">Restringido</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Tipo de documento</Label><Input value={form.doc_type} onChange={(e) => setForm(f => ({ ...f, doc_type: e.target.value }))} placeholder="SOAT, Factura..." /></div>
              <div className="space-y-2"><Label>Vence</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
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
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
