import { useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users2, Calendar, ShoppingCart, CreditCard, FileText, AlertTriangle } from "lucide-react";
import { CustomersTab } from "@/components/sales/CustomersTab";
import { ReservationsTab } from "@/components/sales/ReservationsTab";
import { SalesTab } from "@/components/sales/SalesTab";
import { PaymentsTab } from "@/components/sales/PaymentsTab";
import { DocumentsTab } from "@/components/sales/DocumentsTab";
import { formatCOP } from "@/lib/format";

interface ConversionState {
  saleCreated: boolean;
  saleId: string | null;
  paymentCreated: boolean;
  vehicleUpdated: boolean;
  reservationUpdated: boolean;
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
  const [convertingReservation, setConvertingReservation] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
    registerDepositAsPayment: true,
  });
  const [converting, setConverting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
  
  // Partial conversion state for retry
  const [conversionState, setConversionState] = useState<ConversionState | null>(null);

  const handleConvertToSale = async (reservation: any) => {
    console.log("[Convert] Opening dialog for reservation:", reservation.id);
    
    // Fetch payment methods
    const { data: pmData, error: pmError } = await supabase
      .from("payment_methods")
      .select("code, name")
      .eq("is_active", true);
    
    if (pmError) {
      console.error("[Convert] Error fetching payment methods:", pmError);
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
    setConversionState(null);
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!profile?.org_id || !convertingReservation) {
      toast.error("No se pudo obtener la información del perfil o la reserva");
      return;
    }

    // Validate required fields
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
    
    // Initialize or use existing state
    const state: ConversionState = conversionState || {
      saleCreated: false,
      saleId: null,
      paymentCreated: false,
      vehicleUpdated: false,
      reservationUpdated: false,
    };

    try {
      // STEP 1: Create sale (if not already done)
      if (!state.saleCreated) {
        console.log("[Convert] Step 1: Creating sale...");
        const salePayload = {
          org_id: profile.org_id,
          vehicle_id: convertingReservation.vehicle_id,
          customer_id: convertingReservation.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: convertForm.payment_method_code,
          reservation_id: convertingReservation.id,
          status: "active",
          created_by: profile.id,
          notes: convertForm.notes?.trim() || null,
        };
        console.log("[Convert] Sale payload:", salePayload);

        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .insert(salePayload)
          .select("id")
          .single();

        if (saleError) {
          console.error("[Convert] Step 1 FAILED - Sale creation error:", saleError);
          toast.error(`Error al crear venta: ${saleError.message}${saleError.details ? ` - ${saleError.details}` : ""}`);
          setConverting(false);
          return;
        }

        if (!saleData?.id) {
          console.error("[Convert] Step 1 FAILED - No sale data returned");
          toast.error("Error: No se recibió ID de la venta creada");
          setConverting(false);
          return;
        }

        state.saleCreated = true;
        state.saleId = saleData.id;
        console.log("[Convert] Step 1 SUCCESS - Sale created:", saleData.id);
      }

      // STEP 2: Register deposit as payment (if checkbox checked and not done)
      if (convertForm.registerDepositAsPayment && !state.paymentCreated && state.saleId) {
        console.log("[Convert] Step 2: Registering deposit as payment...");
        const paymentPayload = {
          org_id: profile.org_id,
          sale_id: state.saleId,
          amount_cop: convertingReservation.deposit_amount_cop,
          direction: "in",
          payment_method_code: convertingReservation.payment_method_code,
          notes: "Depósito de reserva",
          created_by: profile.id,
        };
        console.log("[Convert] Payment payload:", paymentPayload);

        const { error: paymentError } = await supabase
          .from("sale_payments")
          .insert(paymentPayload);

        if (paymentError) {
          console.error("[Convert] Step 2 FAILED - Payment error:", paymentError);
          state.paymentCreated = false;
          setConversionState(state);
          toast.error(`Venta creada, pero falló el registro del depósito: ${paymentError.message}`, {
            duration: 10000,
            action: {
              label: "Reintentar",
              onClick: () => handleConfirmConvert(),
            },
          });
          setConverting(false);
          return;
        }
        state.paymentCreated = true;
        console.log("[Convert] Step 2 SUCCESS - Payment registered");
      } else if (!convertForm.registerDepositAsPayment) {
        state.paymentCreated = true; // Skip this step if not requested
      }

      // STEP 3: Update vehicle to 'vendido'
      if (!state.vehicleUpdated) {
        console.log("[Convert] Step 3: Updating vehicle stage to 'vendido'...");
        const { error: vehError } = await supabase.rpc("transition_vehicle_stage", {
          p_vehicle_id: convertingReservation.vehicle_id,
          p_target_stage: "vendido",
        });        

        if (vehError) {
          console.error("[Convert] Step 3 FAILED - Vehicle update error:", vehError);
          setConversionState(state);
          toast.error(`Venta creada, pero falló actualizar el vehículo: ${vehError.message}`, {
            duration: 10000,
            action: {
              label: "Reintentar",
              onClick: () => handleConfirmConvert(),
            },
          });
          setConverting(false);
          return;
        }
        state.vehicleUpdated = true;
        console.log("[Convert] Step 3 SUCCESS - Vehicle updated");
      }

      // STEP 4: Update reservation to 'converted'
      if (!state.reservationUpdated) {
        console.log("[Convert] Step 4: Updating reservation to 'converted'...");
        const { error: resError } = await supabase
          .from("reservations")
          .update({ status: "converted" })
          .eq("id", convertingReservation.id);

        if (resError) {
          console.error("[Convert] Step 4 FAILED - Reservation update error:", resError);
          setConversionState(state);
          toast.error(`Venta creada, pero falló actualizar la reserva: ${resError.message}`, {
            duration: 10000,
            action: {
              label: "Reintentar", 
              onClick: () => handleConfirmConvert(),
            },
          });
          setConverting(false);
          return;
        }
        state.reservationUpdated = true;
        console.log("[Convert] Step 4 SUCCESS - Reservation updated");
      }

      // ALL STEPS COMPLETED
      console.log("[Convert] ALL STEPS COMPLETED SUCCESSFULLY");
      toast.success("Venta registrada exitosamente");
      setConvertDialogOpen(false);
      setConvertingReservation(null);
      setConversionState(null);
      
      // Trigger refresh in child components
      setSalesRefreshKey((k) => k + 1);
      setReservationsRefreshKey((k) => k + 1);
      setPaymentsRefreshKey((k) => k + 1);
      
      setActiveTab("sales");
    } catch (err: any) {
      console.error("[Convert] Unexpected error:", err);
      toast.error(`Error inesperado: ${err.message || "Error desconocido"}`);
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
            
            {conversionState && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-300">Conversión parcial</p>
                  <p className="text-amber-600 dark:text-amber-400">
                    La venta fue creada pero algunos pasos no se completaron. Haz clic en "Continuar" para reintentar.
                  </p>
                </div>
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
                disabled={conversionState?.saleCreated}
              />
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select
                value={convertForm.payment_method_code}
                onValueChange={(v) => setConvertForm({ ...convertForm, payment_method_code: v })}
                disabled={conversionState?.saleCreated}
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
                disabled={conversionState?.paymentCreated}
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
                disabled={conversionState?.saleCreated}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmConvert} disabled={converting}>
              {converting ? "Procesando..." : conversionState ? "Continuar Conversión" : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
