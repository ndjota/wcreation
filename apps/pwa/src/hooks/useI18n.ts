import type { AppLocale } from "@/lib/format";
import { useTranslation } from "react-i18next";

export function useI18n() {
  const { t, i18n } = useTranslation(["common", "devices", "events", "auth", "public"]);
  const locale: AppLocale = i18n.language.startsWith("en") ? "en" : "es-AR";
  return { t, i18n, locale };
}
