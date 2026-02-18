import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuickCustomerForm } from "@/hooks/vehicle/types";

interface Props {
  open: boolean;
  form: QuickCustomerForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: QuickCustomerForm) => void;
  onSubmit: () => void;
}

export function VehicleQuickCustomerDialog({
  open,
  form,
  onOpenChange,
  onFormChange,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear Cliente Rápido</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => onFormChange({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} >Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
