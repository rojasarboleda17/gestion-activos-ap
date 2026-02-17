import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatCOP } from "@/lib/format";
import type { PaymentMethod, Reservation } from "@/hooks/vehicle/useVehicleSalesData";

interface ConvertForm {
  final_price_cop: string;
  payment_method_code: string;
  notes: string;
  registerDepositAsPayment: boolean;
}

interface Props {
  open: boolean;
  converting: boolean;
  reservation: Reservation | null;
  paymentMethods: PaymentMethod[];
  form: ConvertForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ConvertForm) => void;
  onSubmit: () => void;
}

export function VehicleConvertReservationDialog({
  open,
  converting,
  reservation,
  paymentMethods,
  form,
  onOpenChange,
  onFormChange,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convertir Reserva a Venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {reservation && (
            <div className="bg-muted p-3 rounded text-sm">
              <p><strong>Cliente:</strong> {reservation.customers?.full_name}</p>
              <p><strong>Depósito:</strong> {formatCOP(reservation.deposit_amount_cop)}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Precio Final (COP) *</Label>
            <Input
              type="number"
              min="1"
              value={form.final_price_cop}
              onChange={(e) => onFormChange({ ...form, final_price_cop: e.target.value })}
              placeholder="35000000"
            />
          </div>
          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <Select
              value={form.payment_method_code}
              onValueChange={(v) => onFormChange({ ...form, payment_method_code: v })}
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
              checked={form.registerDepositAsPayment}
              onCheckedChange={(checked) => onFormChange({ ...form, registerDepositAsPayment: checked === true })}
            />
            <label htmlFor="registerDeposit" className="text-sm">
              Registrar depósito como pago
            </label>
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
          <Button onClick={onSubmit} disabled={converting}>
            {converting ? "Procesando..." : "Registrar Venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
