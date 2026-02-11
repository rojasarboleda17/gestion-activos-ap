import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { Users2, Calendar, ShoppingCart, CreditCard, FileText } from "lucide-react";
import { CustomersTab } from "@/components/sales/CustomersTab";
import { ReservationsTab } from "@/components/sales/ReservationsTab";
import { SalesTab } from "@/components/sales/SalesTab";
import { PaymentsTab } from "@/components/sales/PaymentsTab";
import { DocumentsTab } from "@/components/sales/DocumentsTab";
import { formatCOP } from "@/lib/format";
import { logger } from "@/lib/logger";

interface ReservationToConvert {
  id: string;
  vehicle_id: string | null;
  customer_id: string | null;
  deposit_amount_cop: number | null;
  payment_method_code: string | null;
  vehicle?: { license_plate: string | null; brand: string | null } | null;
  customer?: { full_name: string | null } | null;
}

export default function AdminSales() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("customers");

  // Refresh keys to trigger refetch in child components
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [reservationsRefreshKey, setReservationsRefreshKey] = useState(0);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);

  // Convert to sale dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingReservation, setConvertingReservation] = useState<ReservationToConvert | null>(null);
  const [convertForm, setConvertForm] = useState({
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
    registerDepositAsPayment: true,
  });
  const [converting, setConverting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
  
  const handleConvertToSale = async (reservation: ReservationToConvert) => {
    logger.debug("[Convert] Opening dialog for reservation:", reservation.id);
    
    // Fetch payment methods
    const { data: pmData, error: pmError } = await supabase
      .from("payment_methods")
      .select("code, name")
      .eq("is_active", true);
    
    if (pmError) {
      logger.error("[Convert] Error fetching payment methods:", pmError);
      toast.error(`Error al cargar métodos de pago: ${pmError.message}`);
      return;
    }
    
    setPaymentMethods(pmData || []);
    setConvertingReservation(reservation);
    setConvertForm({
      final_price_cop: "",
      payment_method_code: reservation.payment_method_code || (pmData?.[0]?.code || ""),
      notes: "",
      registerDepositAsPayment: true,
    });
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!profile?.org_id || !convertingReservation) {
      toast.error("No se pudo obtener la información del perfil o la reserva");
      return;
    }

    if (!convertingReservation.vehicle_id) {
      toast.error("Error: La reserva no tiene un vehículo asociado");
      return;
    }
    if (!convertingReservation.customer_id) {
      toast.error("Error: La reserva no tiene un cliente asociado");
      return;
    }

    const finalPrice = parseInt(convertForm.final_price_cop);
    if (!convertForm.final_price_cop || isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final es requerido y debe ser mayor a 0");
      return;
    }
    if (!convertForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setConverting(true);

    try {
      const { data: saleId, error } = await supabase.rpc("convert_reservation_to_sale", {
        p_reservation_id: convertingReservation.id,
        p_final_price_cop: finalPrice,
        p_payment_method_code: convertForm.payment_method_code,
        p_notes: convertForm.notes?.trim() || null,
        p_register_deposit_as_payment: convertForm.registerDepositAsPayment,
      });

      if (error) {
        toast.error(`Error al convertir reserva: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return;
      }

      if (!saleId) {
        toast.error("Error: No se recibió ID de la venta creada");
        return;
      }

      toast.success("Venta registrada exitosamente");
      setConvertDialogOpen(false);
      setConvertingReservation(null);

      setSalesRefreshKey((k) => k + 1);
      setReservationsRefreshKey((k) => k + 1);
      setPaymentsRefreshKey((k) => k + 1);

      setActiveTab("sales");
    } catch (err: unknown) {
      toast.error(`Error inesperado: ${getErrorMessage(err, "Error desconocido")}`);
    } finally {
      setConverting(false);
    }
  };

  return (
    <AdminLayout
      title="Ventas"
      breadcrumbs={[{ label: "Inicio", href: "/admin/vehicles" }, { label: "Ventas" }]}
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
        <TabsContent value="reservations">
          <ReservationsTab 
            key={reservationsRefreshKey} 
            onConvertToSale={handleConvertToSale} 
            onRefresh={() => setReservationsRefreshKey(k => k + 1)}
          />
        </TabsContent>
        <TabsContent value="sales">
          <SalesTab 
            key={salesRefreshKey} 
            onRefresh={() => {
              setSalesRefreshKey(k => k + 1);
              setPaymentsRefreshKey(k => k + 1);
            }}
          />
        </TabsContent>
        <TabsContent value="payments"><PaymentsTab key={paymentsRefreshKey} /></TabsContent>
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
                <p><strong>Depósito:</strong> {formatCOP(convertingReservation.deposit_amount_cop)}</p>
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
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="registerDeposit"
                checked={convertForm.registerDepositAsPayment}
                onCheckedChange={(checked) => 
                  setConvertForm({ ...convertForm, registerDepositAsPayment: checked === true })
                }
              />
              <label htmlFor="registerDeposit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Registrar depósito ({formatCOP(convertingReservation?.deposit_amount_cop || 0)}) como pago
              </label>
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
