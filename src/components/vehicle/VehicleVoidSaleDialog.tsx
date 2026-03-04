import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentMethod, VehicleStage, VoidForm } from "@/hooks/vehicle/types";

interface Props {
  open: boolean;
  form: VoidForm;
  vehicleStages: VehicleStage[];
  paymentMethods: PaymentMethod[];
  processing: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: VoidForm) => void;
  onConfirm: () => void;
}

export function VehicleVoidSaleDialog({
  open,
  form,
  vehicleStages,
  paymentMethods,
  processing,
  onOpenChange,
  onFormChange,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular venta?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción anulará la venta y cambiará el estado del vehículo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea
              value={form.void_reason}
              onChange={(e) => onFormChange({ ...form, void_reason: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Devolver a estado</Label>
            <Select value={form.return_stage_code} onValueChange={(v) => onFormChange({ ...form, return_stage_code: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {vehicleStages.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reembolso (opcional)</Label>
              <Input
                type="number"
                min="0"
                value={form.refund_amount}
                onChange={(e) => onFormChange({ ...form, refund_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={form.refund_method} onValueChange={(v) => onFormChange({ ...form, refund_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm} disabled={processing}>
              {processing ? "Procesando..." : "Anular Venta"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
