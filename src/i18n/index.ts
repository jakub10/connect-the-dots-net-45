import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import cs from './locales/cs.json';
import sk from './locales/sk.json';
import en from './locales/en.json';

export const SUPPORTED_LANGS = ['cs', 'sk', 'en'] as const;
export type Lang = typeof SUPPORTED_LANGS[number];

export const LANG_LABELS: Record<Lang, string> = {
  cs: '🇨🇿 Čeština',
  sk: '🇸🇰 Slovenčina',
  en: '🇬🇧 English',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      sk: { translation: sk },
      en: { translation: en },
    },
    fallbackLng: 'cs',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kamosfera-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
