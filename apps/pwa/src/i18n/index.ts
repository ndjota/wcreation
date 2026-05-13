import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import authEn from "./en/auth.json";
import commonEn from "./en/common.json";
import devicesEn from "./en/devices.json";
import eventsEn from "./en/events.json";
import publicEn from "./en/public.json";

import authEs from "./es-AR/auth.json";
import commonEs from "./es-AR/common.json";
import devicesEs from "./es-AR/devices.json";
import eventsEs from "./es-AR/events.json";
import publicEs from "./es-AR/public.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "es-AR",
    supportedLngs: ["es-AR", "en"],
    defaultNS: "common",
    ns: ["common", "devices", "events", "auth", "public"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    resources: {
      "es-AR": {
        common: commonEs,
        devices: devicesEs,
        events: eventsEs,
        auth: authEs,
        public: publicEs,
      },
      en: {
        common: commonEn,
        devices: devicesEn,
        events: eventsEn,
        auth: authEn,
        public: publicEn,
      },
    },
  });

export default i18n;
