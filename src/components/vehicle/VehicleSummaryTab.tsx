import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { formatCOP, formatDate, formatKm } from "@/lib/format";
import { AlertTriangle, FileText, Tag } from "lucide-react";

interface Props {
  vehicle: Tables<"vehicles">;
}

export function VehicleSummaryTab({ vehicle }: Props) {
  const [listing, setListing] = useState<Tables<"vehicle_listing"> | null>(null);
  const [compliance, setCompliance] = useState<Tables<"vehicle_compliance"> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, complianceRes] = await Promise.all([
        supabase.from("vehicle_listing").select("*").eq("vehicle_id", vehicle.id).maybeSingle(),
        supabase.from("vehicle_compliance").select("*").eq("vehicle_id", vehicle.id).maybeSingle(),
      ]);
      setListing(listingRes.data);
      setCompliance(complianceRes.data);
    };
    fetchData();
  }, [vehicle.id]);


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
            <span className="text-muted-foreground">Color</span>
            <span>{vehicle.color || "—"}</span>
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

    </div>
  );
}
