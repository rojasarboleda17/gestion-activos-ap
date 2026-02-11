import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { FileText, Plus, Search, Download } from "lucide-react";
import { logger } from "@/lib/logger";

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
  sale?: { id: string };
  reservation?: { id: string };
  customer?: { full_name: string };
  vehicle?: { license_plate: string | null };
}

interface Sale {
  id: string;
  vehicle?: { license_plate: string | null };
  customer?: { full_name: string };
}

interface Reservation {
  id: string;
  vehicle?: { license_plate: string | null };
  customer?: { full_name: string };
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const DOC_TYPES = [
  { value: "contrato", label: "Contrato" },
  { value: "factura", label: "Factura" },
  { value: "cedula", label: "Cédula/Documento" },
  { value: "soat", label: "SOAT" },
  { value: "tecno", label: "Tecnomecánica" },
  { value: "titulo", label: "Título de Propiedad" },
  { value: "otro", label: "Otro" },
];

export function DocumentsTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Filters
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    doc_type: "contrato",
    context_type: "sale",
    context_id: "",
  });

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [docsRes, salesRes, resRes] = await Promise.all([
        supabase
          .from("deal_documents")
          .select(`
            *,
            sale:sales(id),
            reservation:reservations(id),
            customer:customers(full_name),
            vehicle:vehicles!sales_vehicle_id_fkey(license_plate)
          `)
          .eq("org_id", profile.org_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("sales")
          .select(`
            id,
            vehicle:vehicles!sales_vehicle_id_fkey(license_plate),
            customer:customers(full_name)
          `)
          .eq("org_id", profile.org_id)
          .order("sale_date", { ascending: false }),
        supabase
          .from("reservations")
          .select(`
            id,
            vehicle:vehicles!sales_vehicle_id_fkey(license_plate),
            customer:customers(full_name)
          `)
          .eq("org_id", profile.org_id)
          .order("reserved_at", { ascending: false }),
      ]);

      setDocuments(
        (docsRes.data || []).map((d) => ({
          ...d,
          sale: d.sale,
          reservation: d.reservation,
          customer: d.customer,
          vehicle: d.vehicle,
        }))
      );
      setSales(
        (salesRes.data || []).map((s) => ({
          ...s,
          vehicle: s.vehicle,
          customer: s.customer,
        }))
      );
      setReservations(
        (resRes.data || []).map((r) => ({
          ...r,
          vehicle: r.vehicle,
          customer: r.customer,
        }))
      );
    } catch (err) {
      logger.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openUpload = () => {
    setFile(null);
    setForm({
      doc_type: "contrato",
      context_type: "sale",
      context_id: "",
    });
    setUploadDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!profile?.org_id || !file) {
      toast.error("Selecciona un archivo");
      return;
    }
    if (!form.context_id) {
      toast.error("Selecciona una venta o reserva");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const path = `${profile.org_id}/deal/${form.context_id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("customer-uploads")
        .upload(path, file);

      if (uploadError) throw uploadError;

      // Insert document record
      const { error: insertError } = await supabase.from("deal_documents").insert({
        org_id: profile.org_id,
        doc_type: form.doc_type,
        storage_bucket: "customer-uploads",
        storage_path: path,
        sale_id: form.context_type === "sale" ? form.context_id : null,
        reservation_id: form.context_type === "reservation" ? form.context_id : null,
        uploaded_by: profile.id,
      });

      if (insertError) throw insertError;

      toast.success("Documento subido exitosamente");
      setUploadDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Error al subir documento"));
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (doc: DealDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      toast.error(getErrorMessage(err, "Error al descargar documento"));
    }
  };

  // Filter
  const filtered = documents.filter((d) => {
    if (docTypeFilter !== "all" && d.doc_type !== docTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const plate = d.vehicle?.license_plate?.toLowerCase() || "";
      const customer = d.customer?.full_name?.toLowerCase() || "";
      if (!plate.includes(q) && !customer.includes(q)) return false;
    }
    return true;
  });

  const contextOptions = form.context_type === "sale" ? sales : reservations;

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openUpload}>
          <Plus className="h-4 w-4 mr-2" />
          Subir Documento
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description="No hay documentos que coincidan con los filtros."
          action={{ label: "Subir Documento", onClick: openUpload }}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type}
                    </TableCell>
                    <TableCell>
                      {d.sale_id ? "Venta" : d.reservation_id ? "Reserva" : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {d.vehicle?.license_plate || "—"}
                    </TableCell>
                    <TableCell>{d.customer?.full_name || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadDocument(d)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((d) => (
              <Card key={d.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">
                        {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.sale_id ? "Venta" : d.reservation_id ? "Reserva" : "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadDocument(d)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-mono">{d.vehicle?.license_plate || "—"}</p>
                    <p className="text-muted-foreground">{d.customer?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select
                value={form.doc_type}
                onValueChange={(v) => setForm({ ...form, doc_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
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

            <div className="space-y-2">
              <Label>Asociar a *</Label>
              <Select
                value={form.context_type}
                onValueChange={(v) => setForm({ ...form, context_type: v, context_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Venta</SelectItem>
                  <SelectItem value="reservation">Reserva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{form.context_type === "sale" ? "Venta" : "Reserva"} *</Label>
              <Select
                value={form.context_id}
                onValueChange={(v) => setForm({ ...form, context_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {contextOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.vehicle?.license_plate || "S/P"} - {c.customer?.full_name || "Cliente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Archivo *</Label>
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
