import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, LogOut, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acceso No Autorizado</CardTitle>
          <CardDescription>
            No tienes permisos para acceder a esta sección.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Tu rol actual es: <strong className="text-foreground">{profile?.role || "Sin rol"}</strong>
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <Button variant="ghost" onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
