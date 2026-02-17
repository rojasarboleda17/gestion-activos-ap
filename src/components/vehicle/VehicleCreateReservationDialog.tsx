import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer, PaymentMethod } from "@/hooks/vehicle/useVehicleSalesData";

interface ReservationForm {
  customer_id: string;
  deposit_amount_cop: string;
  payment_method_code: string;
  notes: string;
}

interface Props {
  open: boolean;
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  form: ReservationForm;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ReservationForm) => void;
  onSubmit: () => void;
  onOpenQuickCustomer: () => void;
}

export function VehicleCreateReservationDialog({
  open,
  customers,
  paymentMethods,
  form,
  saving,
  onOpenChange,
  onFormChange,
  onSubmit,
  onOpenQuickCustomer,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Cliente *</Label>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={onOpenQuickCustomer}>
                + Crear rápido
              </Button>
            </div>
            <Select value={form.customer_id} onValueChange={(v) => onFormChange({ ...form, customer_id: v })}>
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
              <Input
                type="number"
                min="1"
                value={form.deposit_amount_cop}
                onChange={(e) => onFormChange({ ...form, deposit_amount_cop: e.target.value })}
                placeholder="1000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Método *</Label>
              <Select value={form.payment_method_code} onValueChange={(v) => onFormChange({ ...form, payment_method_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Crear Reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
