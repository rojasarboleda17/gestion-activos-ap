import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDate } from "@/lib/format";
import { DollarSign, X } from "lucide-react";

interface Sale {
  id: string;
  status: string;
  final_price_cop: number;
  sale_date: string;
  customers?: { full_name: string; phone: string | null };
}

interface Props {
  sales: Sale[];
  statusLabels: Record<string, string>;
  canManage: boolean;
  onVoidSale: (sale: Sale) => void;
}

export function VehicleSaleVoidSection({ sales, statusLabels, canManage, onVoidSale }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Ventas ({sales.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{sale.customers?.full_name || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(sale.sale_date)} · {sale.customers?.phone || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <Badge variant={sale.status === "active" ? "default" : "destructive"}>
                      {statusLabels[sale.status] || sale.status}
                    </Badge>
                    <p className="text-sm font-medium">{formatCOP(sale.final_price_cop)}</p>
                  </div>
                  {sale.status === "active" && canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => onVoidSale(sale)}
                      title="Anular"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
