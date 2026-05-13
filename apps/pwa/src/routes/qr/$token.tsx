import { QrLanding } from "@/components/public/QrLanding";
import { api } from "@/lib/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/qr/$token")({
  component: QrPage,
});

function QrPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-qr", token],
    queryFn: () => api.publicQr(token),
  });
  if (q.isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-600">…</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-center text-sm text-red-700">
        Token inválido o desactivado.
      </div>
    );
  }
  return <QrLanding token={token} data={q.data} />;
}
