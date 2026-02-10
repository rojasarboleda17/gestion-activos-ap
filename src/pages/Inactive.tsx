import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogOut, Mail } from "lucide-react";

export default function Inactive() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <AlertCircle className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Usuario No Registrado</CardTitle>
          <CardDescription>
            Tu cuenta ({user?.email}) no tiene un perfil activo en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Contacta al administrador para que te asigne un rol y organización.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:admin@example.com">
                <Mail className="mr-2 h-4 w-4" />
                Contactar Administrador
              </a>
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
