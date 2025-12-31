import { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users2, Calendar, ShoppingCart, CreditCard, FileText } from "lucide-react";
import { CustomersTab } from "@/components/sales/CustomersTab";
import { ReservationsTab } from "@/components/sales/ReservationsTab";
import { SalesTab } from "@/components/sales/SalesTab";
import { PaymentsTab } from "@/components/sales/PaymentsTab";
import { DocumentsTab } from "@/components/sales/DocumentsTab";

export default function AdminSales() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("customers");

  // Convert to sale dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingReservation, setConvertingReservation] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
  });
  const [converting, setConverting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);

  const handleConvertToSale = async (reservation: any) => {
    // Fetch payment methods
    const { data: pmData } = await supabase
      .from("payment_methods")
      .select("code, name")
      .eq("is_active", true);
    setPaymentMethods(pmData || []);

    setConvertingReservation(reservation);
    setConvertForm({
      final_price_cop: "",
      payment_method_code: reservation.payment_method_code || (pmData?.[0]?.code || ""),
      notes: "",
    });
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!profile?.org_id || !convertingReservation) return;

    if (!convertForm.final_price_cop || parseInt(convertForm.final_price_cop) <= 0) {
      toast.error("El precio final es requerido y debe ser mayor a 0");
      return;
    }

    setConverting(true);
    try {
      // Create sale
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          org_id: profile.org_id,
          vehicle_id: convertingReservation.vehicle_id,
          customer_id: convertingReservation.customer_id,
          final_price_cop: parseInt(convertForm.final_price_cop),
          payment_method_code: convertForm.payment_method_code,
          notes: convertForm.notes || null,
          reservation_id: convertingReservation.id,
          status: "active",
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (saleError) throw saleError;

      // Update reservation to converted
      await supabase
        .from("reservations")
        .update({ status: "converted" })
        .eq("id", convertingReservation.id);

      // Update vehicle to 'vendido'
      await supabase
        .from("vehicles")
        .update({ stage_code: "vendido" })
        .eq("id", convertingReservation.vehicle_id);

      // Register deposit as payment
      await supabase.from("sale_payments").insert({
        org_id: profile.org_id,
        sale_id: saleData.id,
        amount_cop: convertingReservation.deposit_amount_cop,
        direction: "in",
        payment_method_code: convertingReservation.payment_method_code,
        notes: "Depósito de reserva",
        created_by: profile.id,
      });

      toast.success("Venta registrada exitosamente");
      setConvertDialogOpen(false);
      setActiveTab("sales");
    } catch (err: any) {
      toast.error(err.message || "Error al convertir a venta");
    } finally {
      setConverting(false);
    }
  };

  return (
    <AdminLayout
      title="Ventas"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Ventas" }]}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="customers" className="gap-2">
            <Users2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Reservas</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Ventas</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagos</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="reservations"><ReservationsTab onConvertToSale={handleConvertToSale} /></TabsContent>
        <TabsContent value="sales"><SalesTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="documents"><DocumentsTab /></TabsContent>
      </Tabs>

      {/* Convert to Sale Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir Reserva a Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {convertingReservation && (
              <div className="bg-muted p-3 rounded text-sm">
                <p><strong>Vehículo:</strong> {convertingReservation.vehicle?.license_plate || "S/P"} - {convertingReservation.vehicle?.brand}</p>
                <p><strong>Cliente:</strong> {convertingReservation.customer?.full_name}</p>
                <p><strong>Depósito:</strong> ${convertingReservation.deposit_amount_cop?.toLocaleString("es-CO")} COP</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Precio Final (COP) *</Label>
              <Input
                type="number"
                min="1"
                value={convertForm.final_price_cop}
                onChange={(e) => setConvertForm({ ...convertForm, final_price_cop: e.target.value })}
                placeholder="35000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select
                value={convertForm.payment_method_code}
                onValueChange={(v) => setConvertForm({ ...convertForm, payment_method_code: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={convertForm.notes}
                onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmConvert} disabled={converting}>
              {converting ? "Procesando..." : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
