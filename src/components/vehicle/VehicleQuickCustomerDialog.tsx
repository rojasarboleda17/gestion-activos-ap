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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IdentityDocumentType, QuickCustomerForm } from "@/hooks/vehicle/types";

interface Props {
  open: boolean;
  form: QuickCustomerForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: QuickCustomerForm) => void;
  onSubmit: () => void;
  identityDocumentTypes: IdentityDocumentType[];
  submitting?: boolean;
}


export function VehicleQuickCustomerDialog({
  open,
  form,
  onOpenChange,
  onFormChange,
  onSubmit,
  identityDocumentTypes,
  submitting = false,
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select
                value={form.id_type_code || "none"}
                onValueChange={(value) => onFormChange({ ...form, id_type_code: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {identityDocumentTypes.map((docType) => (
                    <SelectItem key={docType.code} value={docType.code}>
                      {docType.code} - {docType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Documento</Label>
              <Input
                value={form.document_id}
                onChange={(e) => onFormChange({ ...form, document_id: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={form.city}
                onChange={(e) => onFormChange({ ...form, city: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={submitting}>{submitting ? "Creando..." : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
