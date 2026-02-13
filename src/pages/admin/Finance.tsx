import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark } from "lucide-react";

export default function AdminFinance() {
  return (
    <AdminLayout title="Finanzas">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Módulo de Finanzas
          </CardTitle>
          <CardDescription>Este módulo fue creado para evolucionar en próximas iteraciones.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Por ahora no incluye cálculos ni lógica financiera. Es un punto de partida para que después podamos
            construir funcionalidades.
          </p>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
