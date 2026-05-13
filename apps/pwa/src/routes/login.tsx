import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createFileRoute, redirect, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>) => ({
    from: typeof raw.from === "string" ? raw.from : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const { signInEmail, signInMagicLink, requestPasswordReset } = useAuth();
  const router = useRouter();
  const search = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const afterLogin = () => {
    const target = search.from?.startsWith("/") ? search.from : "/dashboard";
    void router.navigate({ to: target });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-white">{t("auth:loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg ? <p className="text-sm text-lime-300">{msg}</p> : null}
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="em">{t("auth:email")}</Label>
            <Input
              id="em"
              autoComplete="email"
              className="border-slate-700 bg-slate-950 text-slate-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">{t("auth:password")}</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              className="border-slate-700 bg-slate-950 text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setPending(true);
                void signInEmail(email, password)
                  .then(() => afterLogin())
                  .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Error"))
                  .finally(() => setPending(false));
              }}
            >
              {t("auth:signIn")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full border-slate-700 bg-slate-800 text-slate-100"
              disabled={pending}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setPending(true);
                void signInMagicLink(email)
                  .then(() => setMsg(t("auth:magicSent")))
                  .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Error"))
                  .finally(() => setPending(false));
              }}
            >
              {t("auth:magicLink")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-300"
              disabled={pending}
              onClick={() => {
                setErr(null);
                setMsg(null);
                setPending(true);
                void requestPasswordReset(email)
                  .then(() => setMsg(t("auth:resetSent")))
                  .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Error"))
                  .finally(() => setPending(false));
              }}
            >
              {t("auth:forgot")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
