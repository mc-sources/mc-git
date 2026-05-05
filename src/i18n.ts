import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
  },
  lng: (localStorage.getItem("mcgit-settings")
    ? (JSON.parse(localStorage.getItem("mcgit-settings")!) as { state?: { lang?: string } }).state?.lang
    : null) ?? "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export default i18n;
