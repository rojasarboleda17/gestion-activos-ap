import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { getErrorMessage } from "@/lib/errors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import {
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Pause,
  ClipboardList,
  Lock,
  Trash2,
  DollarSign,
  Car,
  Link,
  Upload,
  FileText,
  Image as ImageIcon,
  Receipt,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useAudit } from "@/hooks/use-audit";
import { logger } from "@/lib/logger";

interface Vehicle {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  stage_code: string;
}

interface WorkOrder {
  id: string;
  status: string;
  scope: string;
  vehicle_id: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

interface WorkOrderItem {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  operation_id: string | null;
  accumulated_cost: number;
}

type AttachmentKind = "photo" | "receipt" | "file";

interface ItemAttachment {
  id: string;
  kind: AttachmentKind;
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

interface WorkItemMeta {
  execution_notes: string;
  attachments: ItemAttachment[];
}

interface Profile {
  id: string;
  full_name: string | null;
}

interface CatalogOp {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

interface Props {
  workOrderId: string | null;
  vehicle?: Vehicle | null;
  scope: "vehicle" | "business";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string }
> = {
  pending: { label: "Pendiente", icon: Clock, color: "text-muted-foreground" },
  in_progress: { label: "En Progreso", icon: AlertCircle, color: "text-primary" },
  done: { label: "Completado", icon: CheckCircle, color: "text-success" },
  blocked: { label: "Bloqueado", icon: Pause, color: "text-destructive" },
};

const ITEM_META_TAG = "[work_item_meta]";

const createAttachmentId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseWorkItemMeta = (notes: string | null): WorkItemMeta => {
  const fallback: WorkItemMeta = {
    execution_notes: "",
    attachments: [],
  };

  if (!notes) return fallback;

  const line = notes
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${ITEM_META_TAG}:`));

  if (!line) return fallback;

  const rawJson = line.slice(ITEM_META_TAG.length + 1).trim();
  if (!rawJson) return fallback;

  try {
    const parsed = JSON.parse(rawJson) as Partial<WorkItemMeta>;
    return {
      execution_notes: typeof parsed.execution_notes === "string" ? parsed.execution_notes : "",
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((entry): entry is ItemAttachment => (
          typeof entry?.id === "string"
          && typeof entry?.kind === "string"
          && typeof entry?.bucket === "string"
          && typeof entry?.path === "string"
          && typeof entry?.file_name === "string"
          && typeof entry?.mime_type === "string"
          && typeof entry?.size_bytes === "number"
          && typeof entry?.uploaded_at === "string"
        ))
        : [],
    };
  } catch {
    return fallback;
  }
};

const serializeWorkItemMeta = (meta: WorkItemMeta) => {
  const normalized: WorkItemMeta = {
    execution_notes: meta.execution_notes.trim(),
    attachments: meta.attachments,
  };

  if (!normalized.execution_notes && normalized.attachments.length === 0) {
    return null;
  }

  return `${ITEM_META_TAG}: ${JSON.stringify(normalized)}`;
};

const getAttachmentKindLabel = (kind: AttachmentKind) => {
  if (kind === "photo") return "Foto";
  if (kind === "receipt") return "Comprobante";
  return "Archivo";
};

export function WorkOrderSheet({
  workOrderId,
  vehicle,
  scope,
  open,
  onOpenChange,
  onRefresh,
}: Props) {
  const { profile } = useAuth();
  const { log: auditLog } = useAudit();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogOp[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Dialogs
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [selectedItemForCost, setSelectedItemForCost] = useState<WorkOrderItem | null>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [selectedItemForEvidence, setSelectedItemForEvidence] = useState<WorkOrderItem | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentKind, setAttachmentKind] = useState<AttachmentKind>("photo");

  // Selection for catalog
  const [selectedOps, setSelectedOps] = useState<string[]>([]);

  // Manual item form
  const [manualForm, setManualForm] = useState({ title: "", notes: "" });

  // Cost form
  const [costForm, setCostForm] = useState({
    amount_cop: "",
    incurred_at: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [savingCost, setSavingCost] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    notes: "",
    attachments: [] as ItemAttachment[],
  });

  // Saving states
  const [closing, setClosing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const [woRes, catalogRes, profilesRes] = await Promise.all([
        supabase.from("work_orders").select("*").eq("id", workOrderId).single(),
        supabase
          .from("operation_catalog")
          .select("id, code, name, category")
          .eq("scope", scope)
          .eq("is_active", true)
          .order("name"),
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
      ]);

      if (woRes.data) {
        setWorkOrder(woRes.data);

        // Fetch items with expenses
        const { data: itemsData } = await supabase
          .from("work_order_items")
          .select("*")
          .eq("work_order_id", workOrderId)
          .order("updated_at", { ascending: false });

        // Fetch expense sums per item
        const itemIds = (itemsData || []).map((i) => i.id);
        const expenseMap: Record<string, number> = {};

        if (itemIds.length > 0) {
          if (scope === "vehicle" && woRes.data.vehicle_id) {
            const { data: expData } = await supabase
              .from("vehicle_expenses")
              .select("work_order_item_id, amount_cop")
              .eq("vehicle_id", woRes.data.vehicle_id)
              .in("work_order_item_id", itemIds);

            (expData || []).forEach((e) => {
              if (e.work_order_item_id) {
                expenseMap[e.work_order_item_id] =
                  (expenseMap[e.work_order_item_id] || 0) + (e.amount_cop || 0);
              }
            });
          } else {
            const { data: expData } = await supabase
              .from("business_expenses")
              .select("work_order_item_id, amount_cop")
              .in("work_order_item_id", itemIds);

            (expData || []).forEach((e) => {
              if (e.work_order_item_id) {
                expenseMap[e.work_order_item_id] =
                  (expenseMap[e.work_order_item_id] || 0) + (e.amount_cop || 0);
              }
            });
          }
        }

        setItems(
          (itemsData || []).map((i) => ({
            ...i,
            accumulated_cost: expenseMap[i.id] || 0,
          }))
        );
      }

      setCatalog(catalogRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (err) {
      logger.error("Error fetching work order:", err);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, scope]);

  useEffect(() => {
    if (open && workOrderId) {
      fetchData();
    }
  }, [open, workOrderId, fetchData]);

  // Add items from catalog
  const addItemsFromCatalog = async () => {
    if (!workOrder || !profile?.org_id || selectedOps.length === 0) return;

    try {
      const newItems = selectedOps.map((opId) => {
        const op = catalog.find((c) => c.id === opId);
        return {
          org_id: profile.org_id,
          work_order_id: workOrder.id,
          operation_id: opId,
          title: op?.name || "Operación",
          status: "pending",
        };
      });

      const { error } = await supabase.from("work_order_items").insert(newItems);
      if (error) throw error;

      toast.success(`${selectedOps.length} ítems agregados`);
      setSelectedOps([]);
      setCatalogDialogOpen(false);
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al agregar ítems"));
    }
  };

  // Add manual item
  const addManualItem = async () => {
    if (!workOrder || !profile?.org_id || !manualForm.title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const { error } = await supabase.from("work_order_items").insert({
        org_id: profile.org_id,
        work_order_id: workOrder.id,
        title: manualForm.title.trim(),
        notes: manualForm.notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Ítem agregado");
      setManualForm({ title: "", notes: "" });
      setManualDialogOpen(false);
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al agregar ítem"));
    }
  };

  // Update item inline
  const updateItem = async (
    itemId: string,
    updates: Partial<WorkOrderItem>
  ) => {
    try {
      const payload: Record<string, unknown> = { ...updates };
      delete payload.accumulated_cost;

      if (updates.status === "done") {
        payload.completed_at = new Date().toISOString();
      } else if (updates.status && updates.status !== "done") {
        payload.completed_at = null;
      }

      const { error } = await supabase
        .from("work_order_items")
        .update(payload)
        .eq("id", itemId);

      if (error) throw error;

      // Audit log for status changes
      if (updates.status) {
        auditLog({
          action: "work_order_item_status",
          entity: "work_order_item",
          entity_id: itemId,
          payload: {
            work_order_id: workOrder?.id,
            new_status: updates.status,
            vehicle_id: workOrder?.vehicle_id,
          },
        });
      }

      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
      );
      toast.success("Actualizado");
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al actualizar"));
    }
  };

  // Delete item
  const deleteItem = async () => {
    if (!deleteItemId) return;
    try {
      const { error } = await supabase
        .from("work_order_items")
        .delete()
        .eq("id", deleteItemId);
      if (error) throw error;

      toast.success("Ítem eliminado");
      setItems((prev) => prev.filter((i) => i.id !== deleteItemId));
      setDeleteItemId(null);
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al eliminar"));
    }
  };

  // Close work order
  const closeWorkOrder = async () => {
    if (!workOrder) return;
    setClosing(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", workOrder.id);

      if (error) throw error;
      
      // Audit log
      auditLog({
        action: "work_order_close",
        entity: "work_order",
        entity_id: workOrder.id,
        payload: {
          vehicle_id: workOrder.vehicle_id,
          scope: workOrder.scope,
          items_count: items.length,
          completed_items: items.filter(i => i.status === "done").length,
        },
      });
      
      toast.success("Orden cerrada");
      setCloseDialogOpen(false);
      onOpenChange(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al cerrar orden"));
    } finally {
      setClosing(false);
    }
  };

  // Open cost dialog
  const openCostDialog = (item: WorkOrderItem) => {
    setSelectedItemForCost(item);
    setCostForm({
      amount_cop: "",
      incurred_at: new Date().toISOString().split("T")[0],
      description: item.title,
    });
    setCostDialogOpen(true);
  };

  const openEvidenceDialog = (item: WorkOrderItem) => {
    const meta = parseWorkItemMeta(item.notes);
    setSelectedItemForEvidence(item);
    setEvidenceForm({
      notes: meta.execution_notes,
      attachments: meta.attachments,
    });
    setEvidenceDialogOpen(true);
  };

  const saveEvidence = async () => {
    if (!selectedItemForEvidence) return;

    await updateItem(selectedItemForEvidence.id, {
      notes: serializeWorkItemMeta({
        execution_notes: evidenceForm.notes,
        attachments: evidenceForm.attachments,
      }),
    });

    setEvidenceDialogOpen(false);
    setSelectedItemForEvidence(null);
  };

  const handleUploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !profile?.org_id || !selectedItemForEvidence || !workOrder) return;

    setAttachmentUploading(true);
    try {
      const bucket = "vehicle-internal";
      const uploadedAttachments: ItemAttachment[] = [];

      for (const file of files) {
        const suffix = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${profile.org_id}/operations/work-orders/${workOrder.id}/items/${selectedItemForEvidence.id}/${Date.now()}_${suffix}`;

        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) throw error;

        uploadedAttachments.push({
          id: createAttachmentId(),
          kind: attachmentKind,
          bucket,
          path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        });
      }

      setEvidenceForm((prev) => ({
        ...prev,
        attachments: [...uploadedAttachments, ...prev.attachments],
      }));

      toast.success(uploadedAttachments.length === 1
        ? "Archivo adjunto cargado"
        : `${uploadedAttachments.length} archivos adjuntos cargados`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo subir el archivo"));
    } finally {
      event.target.value = "";
      setAttachmentUploading(false);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    const attachment = evidenceForm.attachments.find((entry) => entry.id === attachmentId);
    if (!attachment) return;

    try {
      const { error } = await supabase.storage.from(attachment.bucket).remove([attachment.path]);
      if (error) throw error;

      setEvidenceForm((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((entry) => entry.id !== attachmentId),
      }));
      toast.success("Adjunto eliminado");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo eliminar el adjunto"));
    }
  };

  const openAttachment = async (attachment: ItemAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 120);

      if (error || !data?.signedUrl) throw error || new Error("No se pudo abrir el adjunto");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo abrir el adjunto"));
    }
  };

  // Save cost
  const saveCost = async () => {
    if (!selectedItemForCost || !workOrder || !profile?.org_id) return;

    if (!costForm.amount_cop || parseInt(costForm.amount_cop) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    setSavingCost(true);
    try {
      const amount = parseInt(costForm.amount_cop, 10);
      const payload = {
        org_id: profile.org_id,
        work_order_item_id: selectedItemForCost.id,
        amount_cop: amount,
        incurred_at: costForm.incurred_at || null,
        description: costForm.description.trim() || null,
        created_by: profile.id,
        category: scope === "vehicle" ? "alistamiento" : "operacion_negocio",
      };

      const { error } = scope === "vehicle" && workOrder.vehicle_id
        ? await supabase.from("vehicle_expenses").insert({
          ...payload,
          vehicle_id: workOrder.vehicle_id,
          phase_code: "alistamiento",
        })
        : await supabase.from("business_expenses").insert(payload);

      if (error) throw error;

      toast.success("Costo registrado");
      setCostDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al registrar costo"));
    } finally {
      setSavingCost(false);
    }
  };

  // Calculate stats
  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.status === "done").length,
    blocked: items.filter((i) => i.status === "blocked").length,
  };
  const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const allDone = stats.total > 0 && stats.done === stats.total;
  const totalCost = items.reduce((sum, i) => sum + i.accumulated_cost, 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {scope === "vehicle" ? "Orden de Alistamiento" : "Orden de Negocio"}
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <LoadingState variant="table" />
          ) : !workOrder ? (
            <EmptyState
              icon={ClipboardList}
              title="Orden no encontrada"
              description="No se pudo cargar la orden de trabajo."
            />
          ) : (
            <div className="space-y-4">
              {/* Vehicle Info (if applicable) */}
              {vehicle && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <Car className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-sm bg-secondary px-2 py-0.5 rounded inline-block">
                          {vehicle.license_plate || "S/P"}
                        </p>
                        <p className="text-sm">
                          {vehicle.brand} {vehicle.line || ""}{" "}
                          {vehicle.model_year || ""}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {vehicle.stage_code}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Progress Card */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Progreso</CardTitle>
                    <Badge variant={allDone ? "default" : "secondary"}>
                      {progress}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={progress} className="h-2" />
                  <div className="grid grid-cols-4 gap-1 text-center text-xs">
                    <div className="bg-muted rounded p-1.5">
                      <p className="font-semibold">{stats.pending}</p>
                      <p className="text-muted-foreground">Pend.</p>
                    </div>
                    <div className="bg-primary/10 rounded p-1.5">
                      <p className="font-semibold text-primary">{stats.in_progress}</p>
                      <p className="text-muted-foreground">Prog.</p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/30 rounded p-1.5">
                      <p className="font-semibold text-green-600">{stats.done}</p>
                      <p className="text-muted-foreground">Hecho</p>
                    </div>
                    <div className="bg-destructive/10 rounded p-1.5">
                      <p className="font-semibold text-destructive">{stats.blocked}</p>
                      <p className="text-muted-foreground">Bloq.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded text-sm">
                    <DollarSign className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">
                      {scope === "vehicle" ? "Costo alistamiento:" : "Costo operación:"}
                    </span>
                    <strong className="text-primary">{formatCOP(totalCost)}</strong>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              {workOrder.status === "open" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCatalogDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Catálogo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManualDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Manual
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCloseDialogOpen(true)}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Cerrar
                  </Button>
                </div>
              )}

              {/* Items List */}
              {items.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Sin ítems"
                  description="Agrega operaciones desde el catálogo o manualmente."
                />
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;

                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="py-3 px-3">
                          <div className="flex items-start gap-2 mb-2">
                            <Icon className={`h-4 w-4 mt-0.5 ${cfg.color}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.accumulated_cost > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Costo: {formatCOP(item.accumulated_cost)}
                                </p>
                              )}
                              {parseWorkItemMeta(item.notes).attachments.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Adjuntos: {parseWorkItemMeta(item.notes).attachments.length}
                                </p>
                              )}
                            </div>
                          </div>

                          {workOrder.status === "open" && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Select
                                value={item.status}
                                onValueChange={(v) => updateItem(item.id, { status: v })}
                              >
                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pendiente</SelectItem>
                                  <SelectItem value="in_progress">En Prog.</SelectItem>
                                  <SelectItem value="done">Hecho</SelectItem>
                                  <SelectItem value="blocked">Bloqueado</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={item.assigned_to || "unassigned"}
                                onValueChange={(v) =>
                                  updateItem(item.id, {
                                    assigned_to: v === "unassigned" ? null : v,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[110px] h-7 text-xs">
                                  <SelectValue placeholder="Asignar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                                  {profiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.full_name || "Usuario"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openCostDialog(item)}
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                Costo
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openEvidenceDialog(item)}
                              >
                                <Link className="h-3 w-3 mr-1" />
                                Evidencia
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteItemId(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog: Add from Catalog */}
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar desde Catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay operaciones en el catálogo para {scope === "vehicle" ? "vehículos" : "negocio"}.
              </p>
            ) : (
              catalog.map((op) => (
                <div key={op.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={op.id}
                    checked={selectedOps.includes(op.id)}
                    onCheckedChange={(checked) => {
                      setSelectedOps((prev) =>
                        checked
                          ? [...prev, op.id]
                          : prev.filter((id) => id !== op.id)
                      );
                    }}
                  />
                  <label htmlFor={op.id} className="text-sm flex-1 cursor-pointer">
                    <span className="font-medium">{op.name}</span>
                    {op.category && (
                      <span className="text-muted-foreground ml-2">({op.category})</span>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addItemsFromCatalog} disabled={selectedOps.length === 0}>
              Agregar ({selectedOps.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manual Item */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Ítem Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="Nombre de la operación"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addManualItem} disabled={!manualForm.title.trim()}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Assign Cost */}
      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Costo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedItemForCost && (
              <p className="text-sm text-muted-foreground">
                Ítem: <strong>{selectedItemForCost.title}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto (COP) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={costForm.amount_cop}
                  onChange={(e) => setCostForm({ ...costForm, amount_cop: e.target.value })}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={costForm.incurred_at}
                  onChange={(e) => setCostForm({ ...costForm, incurred_at: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={costForm.description}
                onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                placeholder="Descripción del costo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCost} disabled={savingCost}>
              {savingCost ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Evidence */}
      <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar evidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedItemForEvidence && (
              <p className="text-sm text-muted-foreground">
                Ítem: <strong>{selectedItemForEvidence.title}</strong>
              </p>
            )}
            <div className="space-y-2">
              <Label>Notas de ejecución</Label>
              <Textarea
                value={evidenceForm.notes}
                onChange={(e) => setEvidenceForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Describe brevemente qué se hizo..."
              />
            </div>
            <div className="space-y-2">
              <Label>Adjuntos (fotos/comprobantes/archivos)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={attachmentKind} onValueChange={(value: AttachmentKind) => setAttachmentKind(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="receipt">Comprobante</SelectItem>
                    <SelectItem value="file">Archivo</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted text-sm">
                  <Upload className="h-4 w-4" />
                  {attachmentUploading ? "Subiendo..." : "Subir archivos"}
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleUploadAttachment}
                    disabled={attachmentUploading}
                  />
                </Label>
              </div>

              {evidenceForm.attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay adjuntos todavía.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto rounded-md border p-2">
                  {evidenceForm.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium flex items-center gap-1">
                          {attachment.kind === "photo" && <ImageIcon className="h-3.5 w-3.5" />}
                          {attachment.kind === "receipt" && <Receipt className="h-3.5 w-3.5" />}
                          {attachment.kind === "file" && <FileText className="h-3.5 w-3.5" />}
                          {attachment.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getAttachmentKindLabel(attachment.kind)} · {(attachment.size_bytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAttachment(attachment)}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAttachment(attachment.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEvidence}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Close Work Order */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              {allDone
                ? "Todos los ítems están completados."
                : "Aún hay ítems sin completar. ¿Deseas cerrar de todos modos?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={closeWorkOrder} disabled={closing}>
              {closing ? "Cerrando..." : "Cerrar Orden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Delete Item */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ítem?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteItem}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
