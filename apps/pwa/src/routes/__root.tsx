import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/lib/supabase";
import "../styles/globals.css";
import "../styles/theme.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  useEffect(() => {
    const onExpired = () => {
      void supabase.auth.signOut().then(() => {
        const from = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?from=${from}`);
      });
    };
    window.addEventListener("wc:auth-expired", onExpired);
    return () => window.removeEventListener("wc:auth-expired", onExpired);
  }, []);

  return (
    <ErrorBoundary>
      <Outlet />
      <Toaster richColors position="top-center" />
    </ErrorBoundary>
  );
}
