import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { useAudit } from "@/hooks/use-audit";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import {
  Calendar,
  Plus,
  Search,
  X,
  ArrowRight,
  AlertTriangle,
  Eye,
  FileDown,
  Pencil,
  User,
  Car,
  ReceiptText,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  payment_method_code: string;
  reserved_at: string;
  notes: string | null;
  advisor_name: string | null;
  customer_id: string;
  vehicle_id: string;
  created_by: string | null;
  cancel_reason: string | null;
  receipt_year: number | null;
  receipt_sequence: number | null;
  customer?: {
    full_name: string;
    phone: string | null;
    document_id: string | null;
  };
  vehicle?: {
    license_plate: string | null;
    brand: string;
    line: string | null;
    model_year: number | null;
    listed_price_cop: number | null;
  };
}

interface Vehicle {
  id: string;
  license_plate: string | null;
  brand: string;
  line: string | null;
  model_year: number | null;
  stage_code: string;
  listed_price_cop: number | null;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  document_id: string | null;
}

interface PaymentMethod {
  code: string;
  name: string;
}

interface Props {
  onConvertToSale?: (reservation: Reservation) => void;
  onRefresh?: () => void;
  preselectedVehicleId?: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  converted: "Convertida",
  cancelled: "Cancelada",
  expired: "Expirada",
};

const DEFAULT_ADVISOR = "Esteban Ocampo";

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");

const buildStyledPdfBlob = (commands: string[]) => {
  const content = commands.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

const wrapPdfText = (input: string, maxLength = 62) => {
  if (!input) return [""];
  const words = input.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxLength) {
      lines.push(current || word);
      current = current ? word : "";
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const pdfText = (text: string, x: number, y: number, size = 11, bold = false) => [
  "BT",
  `${bold ? "/F2" : "/F1"} ${size} Tf`,
  `${x} ${y} Td`,
  `(${escapePdfText(text)}) Tj`,
  "ET",
];

const pdfLine = (x1: number, y1: number, x2: number, y2: number) => `${x1} ${y1} m ${x2} ${y2} l S`;

const pdfRect = (x: number, y: number, w: number, h: number) => `${x} ${y} ${w} ${h} re S`;

const money = (value: number) => formatCOP(value || 0);



export function ReservationsTab({ onConvertToSale, onRefresh, preselectedVehicleId }: Props) {
  const { profile } = useAuth();
  const { log: logAudit } = useAudit();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: preselectedVehicleId || "",
    customer_id: "",
    deposit_amount_cop: "",
    payment_method_code: "",
    notes: "",
    advisor_name: DEFAULT_ADVISOR,
  });

  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ full_name: "", phone: "", document_id: "" });
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingReservation, setCancelingReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    vehicle_id: "",
    customer_id: "",
    deposit_amount_cop: "",
    payment_method_code: "",
    notes: "",
    advisor_name: DEFAULT_ADVISOR,
  });

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      const [resRes, vehRes, custRes, pmRes] = await Promise.all([
        supabase
          .from("reservations")
          .select(`
            *,
            customer:customers(full_name, phone, document_id),
            vehicle:inventory_vehicle_overview(license_plate, brand, line, model_year, listed_price_cop)
          `)
          .eq("org_id", profile.org_id)
          .order("reserved_at", { ascending: false }),
        supabase
          .from("inventory_vehicle_overview")
          .select("id, license_plate, brand, line, model_year, stage_code, listed_price_cop")
          .eq("org_id", profile.org_id)
          .eq("is_archived", false)
          .in("stage_code", ["publicado", "bloqueado"])
          .order("brand"),
        supabase
          .from("customers")
          .select("id, full_name, phone, document_id")
          .eq("org_id", profile.org_id)
          .order("full_name"),
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
      ]);

      if (resRes.error) {
        toast.error(`Error al cargar reservas: ${resRes.error.message}`);
      }

      setReservations((resRes.data || []) as Reservation[]);
      setVehicles((vehRes.data || []) as Vehicle[]);
      setCustomers((custRes.data || []) as Customer[]);
      setPaymentMethods((pmRes.data || []) as PaymentMethod[]);
    } catch (err) {
      logger.error("[Reservations] Unexpected error fetching data:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = profile?.role === "admin";

  const openCreate = () => {
    setForm({
      vehicle_id: preselectedVehicleId || "",
      customer_id: "",
      deposit_amount_cop: "",
      payment_method_code: paymentMethods[0]?.code || "",
      notes: "",
      advisor_name: DEFAULT_ADVISOR,
    });
    setCreateDialogOpen(true);
  };

  const openDetail = async (reservation: Reservation) => {
    setDetailOpen(true);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          *,
          customer:customers(full_name, phone, document_id),
          vehicle:inventory_vehicle_overview(license_plate, brand, line, model_year, listed_price_cop)
        `)
        .eq("id", reservation.id)
        .single();

      if (error) {
        toast.error(`Error al cargar el detalle: ${error.message}`);
        return;
      }

      setSelectedReservation(data as Reservation);
    } catch (err) {
      logger.error("[Reservations] openDetail error", err);
      toast.error("No se pudo abrir el detalle");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async () => {
    if (!profile?.org_id || !profile.id) return;

    if (!form.vehicle_id) return toast.error("Selecciona un vehículo");
    if (!form.customer_id) return toast.error("Selecciona un cliente");
    const depositAmount = parseInt(form.deposit_amount_cop);
    if (!form.deposit_amount_cop || Number.isNaN(depositAmount) || depositAmount <= 0) {
      return toast.error("El depósito debe ser mayor a 0");
    }
    if (!form.payment_method_code) return toast.error("Selecciona un método de pago");

    const { data: existing, error: existingError } = await supabase
      .from("reservations")
      .select("id")
      .eq("vehicle_id", form.vehicle_id)
      .eq("status", "active")
      .maybeSingle();

    if (existingError) {
      toast.error(`Error al verificar reservas existentes: ${existingError.message}`);
      return;
    }
    if (existing) return toast.error("Este vehículo ya tiene una reserva activa.");

    setSaving(true);
    try {
      const payload = {
        org_id: profile.org_id,
        vehicle_id: form.vehicle_id,
        customer_id: form.customer_id,
        deposit_amount_cop: depositAmount,
        payment_method_code: form.payment_method_code,
        notes: form.notes?.trim() || null,
        advisor_name: form.advisor_name?.trim() || DEFAULT_ADVISOR,
        status: "active",
        created_by: profile.id,
      };

      const { data, error } = await supabase.from("reservations").insert(payload).select().single();
      if (error || !data) {
        toast.error(`Error al crear reserva: ${error?.message || "sin respuesta"}`);
        return;
      }

      const { error: vehError } = await supabase
        .from("vehicles")
        .update({ stage_code: "bloqueado" })
        .eq("id", form.vehicle_id);

      if (vehError) {
        toast.warning(`Reserva creada, pero el vehículo no se actualizó: ${vehError.message}`);
      }

      logAudit({
        action: "reservation_create",
        entity: "reservation",
        entity_id: data.id,
        payload: { vehicle_id: data.vehicle_id, customer_id: data.customer_id, deposit_amount_cop: data.deposit_amount_cop },
      }).catch((e) => logger.error("[Audit] reservation_create failed", e));

      toast.success("Reserva creada exitosamente");
      setCreateDialogOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!profile?.org_id) return;
    if (!quickCustomerForm.full_name.trim()) return toast.error("El nombre es requerido");

    setQuickCustomerSaving(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: profile.org_id,
          full_name: quickCustomerForm.full_name.trim(),
          phone: quickCustomerForm.phone?.trim() || null,
          document_id: quickCustomerForm.document_id?.trim() || null,
        })
        .select("id, full_name, phone, document_id")
        .single();

      if (error || !data) {
        toast.error(`Error al crear cliente: ${error?.message || "sin respuesta"}`);
        return;
      }

      setCustomers((prev) => [...prev, data]);
      setForm((prev) => ({ ...prev, customer_id: data.id }));
      setQuickCustomerOpen(false);
      setQuickCustomerForm({ full_name: "", phone: "", document_id: "" });
      toast.success("Cliente creado");
    } catch (err) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setQuickCustomerSaving(false);
    }
  };

  const openCancel = (reservation: Reservation) => {
    setCancelingReservation(reservation);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelingReservation || !profile?.id) return;

    setCanceling(true);
    try {
      const { error, data } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason?.trim() || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile.id,
        })
        .eq("id", cancelingReservation.id)
        .select();

      if (error || !data || data.length === 0) {
        toast.error(`Error al cancelar: ${error?.message || "sin actualización"}`);
        return;
      }

      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", cancelingReservation.vehicle_id)
        .eq("status", "active")
        .neq("id", cancelingReservation.id);

      if (!otherActive || otherActive.length === 0) {
        const { error: vehError } = await supabase
          .from("vehicles")
          .update({ stage_code: "publicado" })
          .eq("id", cancelingReservation.vehicle_id);

        if (vehError) toast.warning(`Reserva cancelada, pero vehículo no actualizado: ${vehError.message}`);
      }

      logAudit({
        action: "reservation_cancel",
        entity: "reservation",
        entity_id: cancelingReservation.id,
        payload: { cancel_reason: cancelReason || null },
      }).catch((e) => logger.error("[Audit] reservation_cancel failed", e));

      toast.success("Reserva cancelada");
      setCancelDialogOpen(false);
      setCancelingReservation(null);
      fetchData();
      onRefresh?.();
    } catch (err) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setCanceling(false);
    }
  };

  const openEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setEditForm({
      vehicle_id: reservation.vehicle_id,
      customer_id: reservation.customer_id,
      deposit_amount_cop: `${reservation.deposit_amount_cop}`,
      payment_method_code: reservation.payment_method_code,
      notes: reservation.notes || "",
      advisor_name: reservation.advisor_name || DEFAULT_ADVISOR,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingReservation || !isAdmin) return;
    const depositAmount = parseInt(editForm.deposit_amount_cop);
    if (!editForm.customer_id || !editForm.vehicle_id || Number.isNaN(depositAmount) || depositAmount <= 0) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setEditSaving(true);
    try {
      if (editingReservation.vehicle_id !== editForm.vehicle_id) {
        const { data: conflict } = await supabase
          .from("reservations")
          .select("id")
          .eq("vehicle_id", editForm.vehicle_id)
          .eq("status", "active")
          .neq("id", editingReservation.id)
          .maybeSingle();

        if (conflict) {
          toast.error("El vehículo seleccionado ya tiene una reserva activa");
          return;
        }
      }

      const { error } = await supabase
        .from("reservations")
        .update({
          customer_id: editForm.customer_id,
          vehicle_id: editForm.vehicle_id,
          deposit_amount_cop: depositAmount,
          payment_method_code: editForm.payment_method_code,
          notes: editForm.notes?.trim() || null,
          advisor_name: editForm.advisor_name?.trim() || DEFAULT_ADVISOR,
        })
        .eq("id", editingReservation.id);

      if (error) {
        toast.error(`Error al actualizar reserva: ${error.message}`);
        return;
      }

      if (editingReservation.vehicle_id !== editForm.vehicle_id) {
        await supabase.from("vehicles").update({ stage_code: "publicado" }).eq("id", editingReservation.vehicle_id);
        await supabase.from("vehicles").update({ stage_code: "bloqueado" }).eq("id", editForm.vehicle_id);
      }

      toast.success("Reserva actualizada");
      setEditDialogOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setEditSaving(false);
    }
  };

  const getOrCreateReceiptNumber = async (reservation: Reservation) => {
    const year = new Date().getFullYear();

    if (reservation.receipt_year === year && reservation.receipt_sequence) {
      return `CR-${String(reservation.receipt_sequence).padStart(4, "0")}`;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("reservations")
      .select("receipt_sequence")
      .eq("org_id", profile?.org_id || "")
      .eq("receipt_year", year)
      .not("receipt_sequence", "is", null)
      .order("receipt_sequence", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const nextSeq = (existingRows?.[0]?.receipt_sequence || 0) + 1;

    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        receipt_year: year,
        receipt_sequence: nextSeq,
        receipt_generated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .is("receipt_sequence", null);

    if (updateError) throw updateError;

    return `CR-${String(nextSeq).padStart(4, "0")}`;
  };

  const generateReceiptPdf = async (reservation: Reservation) => {
    try {
      const fullReservation = selectedReservation?.id === reservation.id ? selectedReservation : reservation;
      const receiptNumber = await getOrCreateReceiptNumber(fullReservation);

      const vehicleValue = fullReservation.vehicle?.listed_price_cop || 0;
      const totalAbonado = fullReservation.deposit_amount_cop || 0;
      const saldo = Math.max(vehicleValue - totalAbonado, 0);
      const today = formatDate(new Date().toISOString());

      const commands: string[] = [];

      commands.push(...pdfText("AutoPremium del Eje", 50, 748, 24, true));
      commands.push(...pdfText("Comprobante de Reserva", 50, 710, 22, true));
      commands.push(pdfLine(50, 700, 560, 700));

      commands.push(...pdfText("Mall Santa Lucia del Bosque - KM +1 Santa Rosa de Cabal - Dosquebradas", 50, 680, 10));
      commands.push(...pdfText("Telefono: +57 313 701 4401", 50, 665, 10));
      commands.push(...pdfText("Correo: autopremiumdeleje@gmail.com", 50, 650, 10));

      commands.push(...pdfText(`N.° Comprobante: ${receiptNumber}`, 390, 710, 11, true));
      commands.push(...pdfText(`Fecha de emisión: ${today}`, 390, 693, 10));

      commands.push(pdfRect(50, 560, 510, 72));
      commands.push(pdfLine(305, 560, 305, 632));
      commands.push(...pdfText("A la atención de", 60, 615, 11, true));
      commands.push(...pdfText(fullReservation.customer?.full_name || "N/D", 60, 598, 11));
      commands.push(...pdfText(`Doc: ${fullReservation.customer?.document_id || "N/D"}`, 60, 582, 10));
      commands.push(...pdfText(`Tel: ${fullReservation.customer?.phone || "N/D"}`, 60, 567, 10));

      commands.push(...pdfText("Vehículo", 315, 615, 11, true));
      commands.push(...pdfText(`${fullReservation.vehicle?.brand || "N/D"} ${fullReservation.vehicle?.line || ""}`.trim(), 315, 598, 11));
      commands.push(...pdfText(`Placa: ${fullReservation.vehicle?.license_plate || "N/D"}`, 315, 582, 10));
      commands.push(...pdfText(`Año: ${fullReservation.vehicle?.model_year || "N/D"}`, 315, 567, 10));
      commands.push(...pdfText(`Asesor: ${fullReservation.advisor_name || DEFAULT_ADVISOR}`, 315, 551, 10));

      commands.push(pdfRect(50, 470, 510, 80));
      commands.push(pdfLine(290, 470, 290, 550));
      commands.push(pdfLine(430, 470, 430, 550));
      commands.push(pdfLine(50, 530, 560, 530));
      commands.push(...pdfText("Descripción", 60, 537, 11, true));
      commands.push(...pdfText("Valor vehículo", 305, 537, 11, true));
      commands.push(...pdfText("Valor abonado", 443, 537, 11, true));

      const descLines = wrapPdfText(`Reserva ${fullReservation.vehicle?.brand || "vehículo"} ${fullReservation.vehicle?.line || ""}`.trim(), 34);
      commands.push(...pdfText(descLines[0] || "Reserva de vehículo", 60, 510, 10));
      if (descLines[1]) commands.push(...pdfText(descLines[1], 60, 496, 10));
      commands.push(...pdfText(money(vehicleValue), 305, 510, 10));
      commands.push(...pdfText(money(totalAbonado), 443, 510, 10));

      commands.push(...pdfText(`Subtotal: ${money(vehicleValue)}`, 360, 440, 11));
      commands.push(...pdfText(`Total abonado: ${money(totalAbonado)}`, 360, 424, 11));
      commands.push(...pdfText(`Saldo pendiente: ${money(saldo)}`, 360, 406, 14, true));

      commands.push(...pdfText("Notas:", 50, 420, 11, true));
      const noteLines = wrapPdfText(fullReservation.notes || "Sin notas", 80).slice(0, 3);
      noteLines.forEach((line, index) => {
        commands.push(...pdfText(line, 50, 402 - (index * 14), 10));
      });

      commands.push(pdfLine(50, 340, 560, 340));
      commands.push(...pdfText("Documento de soporte interno/comercial. No reemplaza factura electrónica DIAN.", 50, 325, 9));
      commands.push(...pdfText("Formato carta vertical - Moneda COP", 50, 312, 9));

      const blob = buildStyledPdfBlob(commands);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${receiptNumber}_${fullReservation.vehicle?.license_plate || fullReservation.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      logAudit({
        action: "reservation_convert",
        entity: "reservation",
        entity_id: fullReservation.id,
        payload: { event: "receipt_generated", receipt_number: receiptNumber },
      }).catch((e) => logger.error("[Audit] receipt generation failed", e));

      fetchData();
      toast.success("Comprobante descargado en PDF");
    } catch (err) {
      logger.error("[Reservations] PDF generation error", err);
      toast.error(`No se pudo descargar el comprobante: ${getErrorMessage(err, "error desconocido")}`);
    }

    setEditSaving(true);
    try {
      if (editingReservation.vehicle_id !== editForm.vehicle_id) {
        const { data: conflict } = await supabase
          .from("reservations")
          .select("id")
          .eq("vehicle_id", editForm.vehicle_id)
          .eq("status", "active")
          .neq("id", editingReservation.id)
          .maybeSingle();

        if (conflict) {
          toast.error("El vehículo seleccionado ya tiene una reserva activa");
          return;
        }
      }

      const { error } = await supabase
        .from("reservations")
        .update({
          customer_id: editForm.customer_id,
          vehicle_id: editForm.vehicle_id,
          deposit_amount_cop: depositAmount,
          payment_method_code: editForm.payment_method_code,
          notes: editForm.notes?.trim() || null,
          advisor_name: editForm.advisor_name?.trim() || DEFAULT_ADVISOR,
        })
        .eq("id", editingReservation.id);

      if (error) {
        toast.error(`Error al actualizar reserva: ${error.message}`);
        return;
      }

      if (editingReservation.vehicle_id !== editForm.vehicle_id) {
        await supabase.from("vehicles").update({ stage_code: "publicado" }).eq("id", editingReservation.vehicle_id);
        await supabase.from("vehicles").update({ stage_code: "bloqueado" }).eq("id", editForm.vehicle_id);
      }

      toast.success("Reserva actualizada");
      setEditDialogOpen(false);
      fetchData();
      onRefresh?.();
    } catch (err) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setEditSaving(false);
    }
  };

  const getOrCreateReceiptNumber = async (reservation: Reservation) => {
    const year = new Date().getFullYear();

    if (reservation.receipt_year === year && reservation.receipt_sequence) {
      return `CR-${String(reservation.receipt_sequence).padStart(4, "0")}`;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("reservations")
      .select("receipt_sequence")
      .eq("org_id", profile?.org_id || "")
      .eq("receipt_year", year)
      .not("receipt_sequence", "is", null)
      .order("receipt_sequence", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const nextSeq = (existingRows?.[0]?.receipt_sequence || 0) + 1;

    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        receipt_year: year,
        receipt_sequence: nextSeq,
        receipt_generated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .is("receipt_sequence", null);

    if (updateError) throw updateError;

    return `CR-${String(nextSeq).padStart(4, "0")}`;
  };

  const generateReceiptPdf = async (reservation: Reservation) => {
    try {
      const fullReservation = selectedReservation?.id === reservation.id ? selectedReservation : reservation;
      const receiptNumber = await getOrCreateReceiptNumber(fullReservation);

      const vehicleValue = fullReservation.vehicle?.listed_price_cop || 0;
      const totalAbonado = fullReservation.deposit_amount_cop || 0;
      const saldo = Math.max(vehicleValue - totalAbonado, 0);

      const lines = [
        "AUTOPREMIUM DEL EJE",
        "Mall Santa Lucia del Bosque - KM +1 Santa Rosa de Cabal - Dosquebradas",
        "Tel: +57 313 701 4401 | Correo: autopremiumdeleje@gmail.com",
        "",
        "COMPROBANTE DE RESERVA",
        `No. Comprobante: ${receiptNumber}`,
        `Fecha de emision: ${formatDate(new Date().toISOString())}`,
        "",
        `Cliente: ${fullReservation.customer?.full_name || "N/D"}`,
        `Documento: ${fullReservation.customer?.document_id || "N/D"}`,
        `Telefono: ${fullReservation.customer?.phone || "N/D"}`,
        "Direccion: N/D",
        `Placa: ${fullReservation.vehicle?.license_plate || "N/D"}`,
        `Vehiculo: ${`${fullReservation.vehicle?.brand || ""} ${fullReservation.vehicle?.line || ""}`.trim() || "N/D"}`,
        `Ano: ${fullReservation.vehicle?.model_year || "N/D"}`,
        `Asesor: ${fullReservation.advisor_name || DEFAULT_ADVISOR}`,
        "",
        "Detalle",
        "- Descripcion: Reserva de vehiculo",
        `- Valor vehiculo reservado: ${formatCOP(vehicleValue)}`,
        `- Valor abonado: ${formatCOP(totalAbonado)}`,
        "",
        `Subtotal: ${formatCOP(vehicleValue)}`,
        `Total abonado: ${formatCOP(totalAbonado)}`,
        `Saldo pendiente: ${formatCOP(saldo)}`,
        "",
        ...toPdfLines(`Nota: ${fullReservation.notes || "Sin notas"}`),
        "",
        "Documento de soporte interno/comercial. No reemplaza factura electronica DIAN.",
      ];

      const blob = buildSimplePdfBlob(lines);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${receiptNumber}_${fullReservation.vehicle?.license_plate || fullReservation.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      logAudit({
        action: "reservation_convert",
        entity: "reservation",
        entity_id: fullReservation.id,
        payload: { event: "receipt_generated", receipt_number: receiptNumber },
      }).catch((e) => logger.error("[Audit] receipt generation failed", e));

      fetchData();
      toast.success("Comprobante descargado en PDF");
    } catch (err) {
      logger.error("[Reservations] PDF generation error", err);
      toast.error(`No se pudo descargar el comprobante: ${getErrorMessage(err, "error desconocido")}`);
    }
  };

  const handleConvert = (reservation: Reservation) => {
    if (onConvertToSale) onConvertToSale(reservation);
  };

  const handleConvert = (reservation: Reservation) => {
    if (onConvertToSale) onConvertToSale(reservation);
  };

  const filtered = reservations.filter((r) => {
    if (preselectedVehicleId && r.vehicle_id !== preselectedVehicleId) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const plate = r.vehicle?.license_plate?.toLowerCase() || "";
      const brand = r.vehicle?.brand?.toLowerCase() || "";
      const customer = r.customer?.full_name?.toLowerCase() || "";
      if (!plate.includes(q) && !brand.includes(q) && !customer.includes(q)) return false;
    }
    return true;
  });

  const availableVehicles = vehicles.filter((v) => {
    if (v.stage_code === "vendido") return false;
    const hasActiveReservation = reservations.some((r) => r.vehicle_id === v.id && r.status === "active");
    return !hasActiveReservation || v.id === preselectedVehicleId;
  });

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-4">
      {!preselectedVehicleId && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, marca, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="converted">Convertidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reserva
          </Button>
        </div>
      )}

      {preselectedVehicleId && (
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Reserva
        </Button>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Sin reservas"
          description={preselectedVehicleId ? "Este vehículo no tiene reservas." : "No hay reservas que coincidan con los filtros."}
          action={{ label: "Crear Reserva", onClick: openCreate }}
        />
      ) : (
        <>
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {!preselectedVehicleId && <TableHead>Vehículo</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Asesor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.reserved_at)}</TableCell>
                    {!preselectedVehicleId && (
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{r.vehicle?.license_plate || "S/P"}</p>
                          <p className="text-xs text-muted-foreground">{r.vehicle?.brand} {r.vehicle?.line || ""} {r.vehicle?.model_year || ""}</p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.customer?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.customer?.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCOP(r.deposit_amount_cop)}</TableCell>
                    <TableCell>{r.advisor_name || DEFAULT_ADVISOR}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "active" ? "default" : r.status === "converted" ? "secondary" : "destructive"}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => generateReceiptPdf(r)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {r.status === "active" && isAdmin && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleConvert(r)}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openCancel(r)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {!preselectedVehicleId && (
                        <>
                          <p className="font-mono text-sm">{r.vehicle?.license_plate || "S/P"}</p>
                          <p className="text-xs text-muted-foreground">{r.vehicle?.brand} {r.vehicle?.line || ""}</p>
                        </>
                      )}
                    </div>
                    <Badge variant={r.status === "active" ? "default" : r.status === "converted" ? "secondary" : "destructive"}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>{r.customer?.full_name || "—"}</p>
                    <p className="font-medium">{formatCOP(r.deposit_amount_cop)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.reserved_at)}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openDetail(r)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => generateReceiptPdf(r)}>
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                  {r.status === "active" && isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openCancel(r)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva Reserva</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {!preselectedVehicleId ? (
              <div className="space-y-2">
                <Label>Vehículo *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.license_plate || "S/P"} - {v.brand} {v.line || ""} {v.model_year || ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableVehicles.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />No hay vehículos disponibles para reservar</p>
                )}
              </div>
            ) : <input type="hidden" value={preselectedVehicleId} />}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente *</Label>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setQuickCustomerOpen(true)}>+ Crear rápido</Button>
              </div>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depósito (COP) *</Label>
                <Input type="number" min="1" value={form.deposit_amount_cop} onChange={(e) => setForm({ ...form, deposit_amount_cop: e.target.value })} placeholder="1000000" />
              </div>
              <div className="space-y-2">
                <Label>Método de pago *</Label>
                <Select value={form.payment_method_code} onValueChange={(v) => setForm({ ...form, payment_method_code: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (<SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Asesor</Label>
              <Input value={form.advisor_name} onChange={(e) => setForm({ ...form, advisor_name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Guardando..." : "Crear Reserva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Reserva</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Vehículo</Label>
              <Select value={editForm.vehicle_id} onValueChange={(v) => setEditForm((prev) => ({ ...prev, vehicle_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.license_plate || "S/P"} - {v.brand} {v.line || ""} {v.model_year || ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={editForm.customer_id} onValueChange={(v) => setEditForm((prev) => ({ ...prev, customer_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depósito</Label>
                <Input type="number" min="1" value={editForm.deposit_amount_cop} onChange={(e) => setEditForm((prev) => ({ ...prev, deposit_amount_cop: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={editForm.payment_method_code} onValueChange={(v) => setEditForm((prev) => ({ ...prev, payment_method_code: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (<SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Asesor</Label>
              <Input value={editForm.advisor_name} onChange={(e) => setEditForm((prev) => ({ ...prev, advisor_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editSaving || !isAdmin}>{editSaving ? "Guardando..." : "Guardar cambios"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Cliente Rápido</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={quickCustomerForm.full_name} onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Documento</Label><Input value={quickCustomerForm.document_id} onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, document_id: e.target.value })} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={quickCustomerForm.phone} onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCustomerOpen(false)}>Cancelar</Button>
            <Button onClick={handleQuickCreateCustomer} disabled={quickCustomerSaving}>{quickCustomerSaving ? "Creando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />Detalle de Reserva</SheetTitle></SheetHeader>
          {!selectedReservation || loadingDetail ? (
            <LoadingState variant="table" rows={2} />
          ) : (
            <div className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span>{selectedReservation.customer?.full_name || "N/D"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Documento</span><span>{selectedReservation.customer?.document_id || "N/D"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Teléfono</span><span>{selectedReservation.customer?.phone || "N/D"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dirección</span><span>N/D</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Car className="h-4 w-4" />Vehículo</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span>{selectedReservation.vehicle?.license_plate || "N/D"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Marca / Línea</span><span>{selectedReservation.vehicle?.brand} {selectedReservation.vehicle?.line || ""}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Año</span><span>{selectedReservation.vehicle?.model_year || "N/D"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Asesor</span><span>{selectedReservation.advisor_name || DEFAULT_ADVISOR}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Valores</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Fecha emisión</span><span>{formatDate(new Date().toISOString())}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor vehículo</span><span>{formatCOP(selectedReservation.vehicle?.listed_price_cop || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total abonado</span><span className="font-medium">{formatCOP(selectedReservation.deposit_amount_cop)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo pendiente</span><span className="font-bold">{formatCOP(Math.max((selectedReservation.vehicle?.listed_price_cop || 0) - selectedReservation.deposit_amount_cop, 0))}</span></div>
                  {selectedReservation.notes && <div className="pt-2 border-t"><p className="text-muted-foreground">Nota:</p><p>{selectedReservation.notes}</p></div>}
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button className="w-full" onClick={() => generateReceiptPdf(selectedReservation)}><FileDown className="h-4 w-4 mr-2" />Generar Comprobante PDF</Button>
                {selectedReservation.status === "active" && isAdmin && (
                  <>
                    <Button className="w-full" variant="outline" onClick={() => openEdit(selectedReservation)}><Pencil className="h-4 w-4 mr-2" />Editar / Cambiar reserva</Button>
                    <Button className="w-full" variant="destructive" onClick={() => openCancel(selectedReservation)}><X className="h-4 w-4 mr-2" />Anular reserva</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción cancelará la reserva y liberará el vehículo si no hay otras reservas activas.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo de cancelación (opcional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ej: Cliente desistió..." className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={canceling || !isAdmin}>{canceling ? "Cancelando..." : "Cancelar Reserva"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
