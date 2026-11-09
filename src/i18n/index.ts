import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import si from './si.json'
import ta from './ta.json'

// NOTE: the Sinhala and Tamil strings are first drafts. Have a native
// speaker review them before release.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
] as const

let saved: string | null = null
try {
  saved = localStorage.getItem('lang')
} catch {
  // storage unavailable; use the default
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
  lng: saved ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem('lang', lng)
  } catch {
    // ignore
  }
})

export default i18n
