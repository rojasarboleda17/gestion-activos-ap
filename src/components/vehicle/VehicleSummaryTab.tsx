import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCOP, formatDate, formatKm } from "@/lib/format";
import { AlertTriangle, DollarSign, FileText, Tag } from "lucide-react";

interface Props {
  vehicle: any;
  onRefresh: () => void;
}

export function VehicleSummaryTab({ vehicle, onRefresh }: Props) {
  const [listing, setListing] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, complianceRes, financialsRes, expensesRes] = await Promise.all([
        supabase.from("vehicle_listing").select("*").eq("vehicle_id", vehicle.id).maybeSingle(),
        supabase.from("vehicle_compliance").select("*").eq("vehicle_id", vehicle.id).maybeSingle(),
        supabase.from("vehicle_financials").select("*").eq("vehicle_id", vehicle.id).maybeSingle(),
        supabase.from("vehicle_expenses").select("amount_cop").eq("vehicle_id", vehicle.id),
      ]);
      setListing(listingRes.data);
      setCompliance(complianceRes.data);
      setFinancials(financialsRes.data);
      setTotalExpenses((expensesRes.data || []).reduce((sum, e) => sum + (e.amount_cop || 0), 0));
    };
    fetchData();
  }, [vehicle.id]);

  const purchasePrice = financials?.purchase_price_cop || 0;
  const totalCost = purchasePrice + totalExpenses;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Información Básica */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Información
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Placa</span>
            <span className="font-mono">{vehicle.license_plate || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VIN</span>
            <span className="font-mono text-xs">{vehicle.vin || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clase</span>
            <span>{vehicle.vehicle_class || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transmisión</span>
            <span>{vehicle.transmission || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Combustible</span>
            <span>{vehicle.fuel_type || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kilometraje</span>
            <span>{formatKm(vehicle.mileage_km)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Comercial */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" /> Comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Publicado</span>
            {listing?.is_listed ? (
              <Badge variant="default">Sí</Badge>
            ) : (
              <Badge variant="secondary">No</Badge>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio Listado</span>
            <span className="font-medium">{formatCOP(listing?.listed_price_cop)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Cumplimiento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Cumplimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">SOAT</span>
            <span>{compliance?.soat_expires_at ? formatDate(compliance.soat_expires_at) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tecnomecánica</span>
            <span>{compliance?.tecnomecanica_expires_at ? formatDate(compliance.tecnomecanica_expires_at) : "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Multas</span>
            {compliance?.has_fines ? (
              <Badge variant="destructive">{formatCOP(compliance.fines_amount_cop)}</Badge>
            ) : (
              <Badge variant="outline">Sin multas</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financiero */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio Compra</span>
            <span>{formatCOP(purchasePrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gastos</span>
            <span>{formatCOP(totalExpenses)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-2">
            <span>Costo Total</span>
            <span>{formatCOP(totalCost)}</span>
          </div>
          {listing?.listed_price_cop && (
            <div className="flex justify-between text-primary font-medium">
              <span>Margen Estimado</span>
              <span>{formatCOP(listing.listed_price_cop - totalCost)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
