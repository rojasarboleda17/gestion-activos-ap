import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, RefreshCw, Download } from "lucide-react";
import {
  enqueueContract,
  findLatestContractDoc,
  getContractSignedUrl,
  type DealDocumentContract,
} from "@/lib/contractApi";

type ContractStatus = "idle" | "missing" | "pending" | "processing" | "done" | "error";

interface ContractPanelProps {
  saleId: string;
  supabase: SupabaseClient;
}

const POLLING_STATUSES: ContractStatus[] = ["pending", "processing"];

export function ContractPanel({ saleId, supabase }: ContractPanelProps) {
  const [docId, setDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<ContractStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearPolling = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const parseStatus = (doc: DealDocumentContract | null): ContractStatus => {
    if (!doc) return "missing";
    if (doc.generation_status === "pending") return "pending";
    if (doc.generation_status === "processing") return "processing";
    if (doc.generation_status === "done") return "done";
    if (doc.generation_status === "error") return "error";
    return "idle";
  };

  const refreshSignedUrl = useCallback(async (dealDocumentId: string) => {
    const result = await getContractSignedUrl(supabase, dealDocumentId);
    if ("url" in result) {
      setSignedUrl(result.url);
      setStatus("done");
      return result.url;
    }

    const nextStatus = (result.status as ContractStatus) || "processing";
    setStatus(nextStatus);
    if (nextStatus === "error") {
      setError(result.generation_error || "Error al generar el contrato");
    }
    return null;
  }, [supabase]);

  const syncContractState = useCallback(async () => {
    const doc = await findLatestContractDoc(supabase, saleId);

    if (!doc) {
      setDocId(null);
      setStatus("missing");
      setSignedUrl(null);
      setError(null);
      return;
    }

    const nextStatus = parseStatus(doc);
    setDocId(doc.id);
    setStatus(nextStatus);
    setError(doc.generation_error || null);

    if (nextStatus === "done") {
      await refreshSignedUrl(doc.id);
    } else {
      setSignedUrl(null);
    }
  }, [refreshSignedUrl, saleId, supabase]);

  const pollContractStatus = useCallback(() => {
    clearPolling();
    intervalRef.current = window.setInterval(async () => {
      try {
        const doc = await findLatestContractDoc(supabase, saleId);
        if (!doc) {
          setStatus("missing");
          clearPolling();
          return;
        }

        const nextStatus = parseStatus(doc);
        setDocId(doc.id);
        setStatus(nextStatus);
        setError(doc.generation_error || null);

        if (nextStatus === "done") {
          await refreshSignedUrl(doc.id);
          clearPolling();
        }

        if (nextStatus === "error") {
          clearPolling();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error consultando estado del contrato");
        setStatus("error");
        clearPolling();
      }
    }, 5000);
  }, [refreshSignedUrl, saleId, supabase]);

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        await syncContractState();
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "No se pudo cargar el contrato");
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();

    return () => clearPolling();
  }, [syncContractState]);

  useEffect(() => {
    if (POLLING_STATUSES.includes(status)) {
      pollContractStatus();
      return;
    }

    clearPolling();
  }, [status, pollContractStatus]);

  const onGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setSignedUrl(null);

    try {
      const response = await enqueueContract(supabase, saleId);
      setDocId(response.deal_document_id);
      setStatus("pending");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se pudo encolar el contrato");
    } finally {
      setIsLoading(false);
    }
  };

  const onDownload = async () => {
    if (!docId) return;

    setIsLoading(true);
    setError(null);
    try {
      const url = await refreshSignedUrl(docId);
      if (!url) {
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("No se pudo descargar el PDF");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `CONTRATO_${saleId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar contrato");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {docId && (
          <p className="text-xs text-muted-foreground">
            deal_document_id: <span className="font-mono">{docId}</span>
          </p>
        )}

        {isLoading && status === "idle" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando contrato...
          </div>
        ) : null}

        {status === "missing" && (
          <Button onClick={onGenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generar contrato
          </Button>
        )}

        {POLLING_STATUSES.includes(status) && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando contrato...
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error || "Error al generar el contrato"}</p>
            <Button variant="outline" onClick={onGenerate} disabled={isLoading}>
              Reintentar
            </Button>
          </div>
        )}

        {status === "done" && docId && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={onDownload} disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              <Button
                variant="outline"
                onClick={() => refreshSignedUrl(docId)}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refrescar vista previa
              </Button>
            </div>

            {signedUrl ? (
              <iframe
                title="Vista previa del contrato"
                src={signedUrl}
                style={{ width: "100%", height: "75vh", border: 0 }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Cargando vista previa...</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
