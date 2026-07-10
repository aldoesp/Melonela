import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

const LANGUAGE_STORAGE_KEY = "melonela:language";
const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
const initialLanguage = storedLanguage === "en" || storedLanguage === "fr" ? storedLanguage : "fr";

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on("languageChanged", (language) => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.documentElement.lang = language;
});

document.documentElement.lang = initialLanguage;

export default i18n;
