import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS, es } from "date-fns/locale";

const locales = { "es-AR": es, en: enUS } as const;

export type AppLocale = keyof typeof locales;

export function formatTemp(celsius: number | null | undefined, locale: AppLocale): string {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return "—";
  const u = locale === "en" ? "°C" : "°C";
  return `${celsius.toFixed(1)}${u}`;
}

export function formatDate(ts: string | Date | null | undefined, locale: AppLocale, withTime = true): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return "—";
  const loc = locales[locale];
  if (locale === "en") {
    return withTime ? format(d, "MMM d, yyyy, h:mm a", { locale: loc }) : format(d, "MMM d, yyyy", { locale: loc });
  }
  return withTime ? format(d, "d MMM yyyy, HH:mm 'hs'", { locale: loc }) : format(d, "d MMM yyyy", { locale: loc });
}

export function formatRelative(ts: string | Date | null | undefined, locale: AppLocale): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return "—";
  const loc = locales[locale];
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: loc });
}
