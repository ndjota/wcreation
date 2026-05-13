import type { Session } from "@supabase/supabase-js";
import type { RoleCode } from "@wcreation/shared";
import { realtimeWs } from "@/lib/ws";
import { supabase } from "@/lib/supabase";
import * as React from "react";

export interface UserProfile {
  id: string;
  tenant_id: string | null;
  role_code: RoleCode;
  email: string;
  nombre: string;
  activo: boolean;
}

export interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthCtx = React.createContext<{
  auth: AuthState;
  accessToken: string | null;
  refresh: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
} | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .schema("wcreation")
    .from("users")
    .select("id, tenant_id, role_code, email, nombre, activo")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id as string,
    tenant_id: (data.tenant_id as string | null) ?? null,
    role_code: data.role_code as RoleCode,
    email: data.email as string,
    nombre: data.nombre as string,
    activo: data.activo as boolean,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = React.useState<AuthState>({ session: null, profile: null, loading: true });

  const applySession = React.useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setAuth({ session: null, profile: null, loading: false });
      realtimeWs.setAuthToken(null);
      return;
    }
    const profile = await fetchProfile(session.user.id);
    setAuth({ session, profile, loading: false });
    realtimeWs.setAuthToken(session.access_token);
  }, []);

  React.useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const refresh = React.useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    await applySession(data.session ?? null);
  }, [applySession]);

  const signInEmail = React.useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await applySession(data.session);
    },
    [applySession],
  );

  const signInMagicLink = React.useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    await applySession(null);
  }, [applySession]);

  const requestPasswordReset = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }, []);

  const accessToken = auth.session?.access_token ?? null;

  const value = React.useMemo(
    () => ({
      auth,
      accessToken,
      refresh,
      signInEmail,
      signInMagicLink,
      signOut,
      requestPasswordReset,
    }),
    [auth, accessToken, refresh, signInEmail, signInMagicLink, signOut, requestPasswordReset],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): NonNullable<React.ContextType<typeof AuthCtx>> {
  const v = React.useContext(AuthCtx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}

export function useRole(): RoleCode | null {
  return useAuth().auth.profile?.role_code ?? null;
}

export function useUser(): UserProfile | null {
  return useAuth().auth.profile;
}
