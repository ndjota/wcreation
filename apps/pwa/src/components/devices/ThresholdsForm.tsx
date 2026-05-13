import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/hooks/useI18n";
import { api, type DeviceThresholdsRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type FormValues = {
  temp_interna_min: string;
  temp_interna_max: string;
  temp_ambiente_min: string;
  temp_ambiente_max: string;
  bateria_min_pct: string;
  corte_red_max_seg: string;
  puerta_abierta_max_seg: string;
  modificable_por_responsable: boolean;
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ThresholdsForm({
  deviceId,
  initial,
  readOnly,
}: {
  deviceId: string;
  initial: DeviceThresholdsRow | null;
  readOnly: boolean;
}) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const form = useForm<FormValues>({
    defaultValues: {
      temp_interna_min: initial?.temp_interna_min?.toString() ?? "",
      temp_interna_max: initial?.temp_interna_max?.toString() ?? "",
      temp_ambiente_min: initial?.temp_ambiente_min?.toString() ?? "",
      temp_ambiente_max: initial?.temp_ambiente_max?.toString() ?? "",
      bateria_min_pct: initial?.bateria_min_pct?.toString() ?? "",
      corte_red_max_seg: initial?.corte_red_max_seg?.toString() ?? "",
      puerta_abierta_max_seg: initial?.puerta_abierta_max_seg?.toString() ?? "",
      modificable_por_responsable: initial?.modificable_por_responsable ?? false,
    },
  });

  useEffect(() => {
    form.reset({
      temp_interna_min: initial?.temp_interna_min?.toString() ?? "",
      temp_interna_max: initial?.temp_interna_max?.toString() ?? "",
      temp_ambiente_min: initial?.temp_ambiente_min?.toString() ?? "",
      temp_ambiente_max: initial?.temp_ambiente_max?.toString() ?? "",
      bateria_min_pct: initial?.bateria_min_pct?.toString() ?? "",
      corte_red_max_seg: initial?.corte_red_max_seg?.toString() ?? "",
      puerta_abierta_max_seg: initial?.puerta_abierta_max_seg?.toString() ?? "",
      modificable_por_responsable: initial?.modificable_por_responsable ?? false,
    });
  }, [initial, form]);

  const mut = useMutation({
    mutationFn: async (body: Partial<DeviceThresholdsRow>) => {
      if (!accessToken) throw new Error("no token");
      return api.putThresholds(accessToken, deviceId, body);
    },
    onSuccess: async () => {
      toast.success(t("devices:thresholdsSaved"));
      await qc.invalidateQueries({ queryKey: ["device", deviceId] });
      await qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const onSubmit = form.handleSubmit((vals) => {
    if (readOnly) return;
    mut.mutate({
      temp_interna_min: numOrNull(vals.temp_interna_min),
      temp_interna_max: numOrNull(vals.temp_interna_max),
      temp_ambiente_min: numOrNull(vals.temp_ambiente_min),
      temp_ambiente_max: numOrNull(vals.temp_ambiente_max),
      bateria_min_pct: numOrNull(vals.bateria_min_pct),
      corte_red_max_seg: numOrNull(vals.corte_red_max_seg),
      puerta_abierta_max_seg: numOrNull(vals.puerta_abierta_max_seg),
      modificable_por_responsable: vals.modificable_por_responsable,
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("devices:thresholdsTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-xl gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            void onSubmit(e);
          }}
        >
          <div>
            <Label htmlFor="tmin">{t("devices:tempInternaMin")}</Label>
            <Input id="tmin" type="number" step="0.1" disabled={readOnly} {...form.register("temp_interna_min")} />
          </div>
          <div>
            <Label htmlFor="tmax">{t("devices:tempInternaMax")}</Label>
            <Input id="tmax" type="number" step="0.1" disabled={readOnly} {...form.register("temp_interna_max")} />
          </div>
          <div>
            <Label htmlFor="amin">{t("devices:tempAmbienteMin")}</Label>
            <Input id="amin" type="number" step="0.1" disabled={readOnly} {...form.register("temp_ambiente_min")} />
          </div>
          <div>
            <Label htmlFor="amax">{t("devices:tempAmbienteMax")}</Label>
            <Input id="amax" type="number" step="0.1" disabled={readOnly} {...form.register("temp_ambiente_max")} />
          </div>
          <div>
            <Label htmlFor="bat">{t("devices:bateriaMin")}</Label>
            <Input id="bat" type="number" disabled={readOnly} {...form.register("bateria_min_pct")} />
          </div>
          <div>
            <Label htmlFor="corte">{t("devices:corteRedMax")}</Label>
            <Input id="corte" type="number" disabled={readOnly} {...form.register("corte_red_max_seg")} />
          </div>
          <div>
            <Label htmlFor="puerta">{t("devices:puertaMax")}</Label>
            <Input id="puerta" type="number" disabled={readOnly} {...form.register("puerta_abierta_max_seg")} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              disabled={readOnly}
              checked={form.watch("modificable_por_responsable")}
              onCheckedChange={(c) => form.setValue("modificable_por_responsable", c)}
            />
            <Label>{t("devices:modificableResponsable")}</Label>
          </div>
          {!readOnly ? (
            <div className="sm:col-span-2">
              <Button type="submit" disabled={mut.isPending}>
                {t("common:save")}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
