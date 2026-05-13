import { AppShell } from "@/components/layout/AppShell";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: {
          from:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : location.pathname,
        },
      });
    }
  },
  component: AppShell,
});
