import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase";

type PendingFactor = { id: string; qrCode: string };

export function MfaTotpCard() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState<PendingFactor | null>(null);
  const [code, setCode] = useState("");

  const refresh = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const [factors, assurance] = await Promise.all([
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factors.error || assurance.error) throw factors.error ?? assurance.error;
    const factor = factors.data.totp.find((item) => item.status === "verified");
    setVerified(Boolean(factor && assurance.data.currentLevel === "aal2"));
    setPending(null);
  };

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Loads the remote MFA session state.
    void refresh()
      .catch(() => toast.error("No se ha podido consultar el estado de MFA."))
      .finally(() => setLoading(false));
  }, []);

  const startEnrollment = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "LEX Authenticator",
        issuer: "LEX",
      });
      if (error || !data.totp?.qr_code) throw error ?? new Error("No se ha generado el código QR.");
      setPending({ id: data.id, qrCode: data.totp.qr_code });
    } catch {
      toast.error("No se ha podido iniciar la configuración de MFA.");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending || code.trim().length !== 6) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    try {
      const challenge = await client.auth.mfa.challenge({ factorId: pending.id });
      if (challenge.error || !challenge.data) throw challenge.error;
      const result = await client.auth.mfa.verify({
        factorId: pending.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (result.error) throw result.error;
      await client.auth.refreshSession();
      setVerified(true);
      setPending(null);
      setCode("");
      toast.success("MFA activado para esta sesión.");
    } catch {
      toast.error("El código de verificación no es válido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base">Autenticación en dos pasos</CardTitle>
            <CardDescription className="mt-1">
              Obligatoria para modificar el despacho o administrar accesos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending ? (
          <form className="space-y-3" onSubmit={(event) => void verify(event)}>
            <img
              className="mx-auto size-40 rounded border bg-white p-2"
              src={`data:image/svg+xml;utf8,${encodeURIComponent(pending.qrCode)}`}
              alt="Código QR para configurar LEX en la aplicación autenticadora"
            />
            <Input
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Código de seis dígitos"
            />
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verificar y activar
            </Button>
          </form>
        ) : verified ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldCheck className="text-primary h-4 w-4" /> Sesión verificada con MFA.
          </p>
        ) : (
          <Button className="w-full" disabled={loading} onClick={() => void startEnrollment()}>
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Configurar aplicación autenticadora
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
