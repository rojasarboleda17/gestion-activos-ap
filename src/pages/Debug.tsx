import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  stage_code: string;
}

interface VehicleFinancial {
  vehicle_id: string;
  purchase_price_cop: number;
}

const Debug = () => {
  const [user, setUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [financialsCount, setFinancialsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ vehicles?: string; financials?: string }>({});
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Fetch vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, license_plate, brand, stage_code")
        .limit(20);

      if (vehiclesError) {
        setErrors(prev => ({ ...prev, vehicles: vehiclesError.message }));
      } else {
        setVehicles(vehiclesData || []);
      }

      // Fetch vehicle_financials
      const { data: financialsData, error: financialsError } = await supabase
        .from("vehicle_financials")
        .select("vehicle_id, purchase_price_cop")
        .limit(5);

      if (financialsError) {
        setErrors(prev => ({ ...prev, financials: financialsError.message }));
      } else {
        setFinancialsCount(financialsData?.length || 0);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Debug - Supabase Connection</h1>
          {user && (
            <Button variant="outline" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          )}
        </div>

        {/* Usuario autenticado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Usuario Autenticado
              {user ? (
                <Badge variant="default">Conectado</Badge>
              ) : (
                <Badge variant="destructive">No autenticado</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <p className="text-foreground">
                <span className="text-muted-foreground">Email:</span> {user.email}
              </p>
            ) : (
              <p className="text-muted-foreground">No hay usuario autenticado</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Vehicles
              <Badge variant="secondary">{vehicles.length} registros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errors.vehicles ? (
              <p className="text-destructive">Error: {errors.vehicles}</p>
            ) : vehicles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-muted-foreground">ID</th>
                      <th className="px-4 py-2 text-left text-muted-foreground">Placa</th>
                      <th className="px-4 py-2 text-left text-muted-foreground">Marca</th>
                      <th className="px-4 py-2 text-left text-muted-foreground">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} className="border-b border-border">
                        <td className="px-4 py-2 font-mono text-xs text-foreground">{v.id.slice(0, 8)}...</td>
                        <td className="px-4 py-2 text-foreground">{v.license_plate}</td>
                        <td className="px-4 py-2 text-foreground">{v.brand}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{v.stage_code}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">No se encontraron vehículos</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Financials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Vehicle Financials
              <Badge variant={financialsCount > 0 ? "default" : "destructive"}>
                {financialsCount} registros
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errors.financials ? (
              <p className="text-destructive">Error: {errors.financials}</p>
            ) : (
              <p className="text-foreground">
                Registros devueltos: <strong>{financialsCount}</strong>
                {financialsCount === 0 && (
                  <span className="ml-2 text-muted-foreground">
                    (RLS puede estar bloqueando el acceso)
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Debug;
