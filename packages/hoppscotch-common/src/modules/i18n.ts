import * as A from "fp-ts/Array"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as R from "fp-ts/Record"
import { createI18n, I18n, I18nOptions } from "vue-i18n"
import { HoppModule } from "."

import languages from "../../languages.json"

import { throwError } from "~/helpers/functional/error"
import { PersistenceService } from "~/services/persistence"
import { getService } from "./dioc"

import FALLBACK_LANG_MESSAGES from "../../locales/en.json"

/*
  In context of this file, we have 2 main kinds of things.
  1. Locale -> A locale is termed as the i18n entries present in the /locales folder
  2. Language -> A language is an entry in the /languages.json folder

  Each language entry should correspond to a locale entry.
*/

/*
 * As we migrate out of Nuxt I18n into our own system for i18n management,
 * Some stuff has changed regarding how it works.
 *
 * The previous system works by using paths to represent locales to load.
 * Basically, /es/realtime will load the /realtime page but with 'es' language
 *
 * In the new system instead of relying on the lang code, we store the language
 * in the application local config store (localStorage). The URLs don't have
 * a locale path effect
 */

// TODO: Syncing into settings ?

const LOCALES = import.meta.glob("../../locales/*.json")

type LanguagesDef = {
  code: string
  file: string
  iso: string
  name: string
  dir?: "ltr" | "rtl" // Text Orientation (defaults to 'ltr')
}

const FALLBACK_LANG_CODE = "en"

const persistenceService = getService(PersistenceService)

// TypeScript cannot understand dir is restricted to "ltr" or "rtl" yet, hence assertion
export const APP_LANGUAGES: LanguagesDef[] = languages as LanguagesDef[]

export const APP_LANG_CODES = languages.map(({ code }) => code)

export const FALLBACK_LANG = pipe(
  APP_LANGUAGES,
  A.findFirst((x) => x.code === FALLBACK_LANG_CODE),
  O.getOrElseW(() =>
    throwError(`Could not find the fallback language '${FALLBACK_LANG_CODE}'`)
  )
)

// A reference to the i18n instance
let i18nInstance: I18n<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  string,
  true
> | null = null

const resolveCurrentLocale = () =>
  pipe(
    // Resolve from locale and make sure it is in languages
    persistenceService.getLocalConfig("locale"),
    O.fromNullable,
    O.filter((locale) =>
      pipe(
        APP_LANGUAGES,
        A.some(({ code }) => code === locale)
      )
    ),

    // Else load from navigator.language
    O.alt(() =>
      pipe(
        APP_LANGUAGES,
        A.findFirst(({ code }) => navigator.language.startsWith(code)), // en-US should also match to en
        O.map(({ code }) => code)
      )
    ),

    // Else load fallback
    O.getOrElse(() => FALLBACK_LANG_CODE)
  )

/**
 * Changes the application language. This function returns a promise as
 * the locale files are lazy loaded on demand
 * @param locale The locale code of the language to load
 */
export const changeAppLanguage = async (locale: string) => {
  const localeData = (
    (await pipe(
      LOCALES,
      R.lookup(`../../locales/${locale}.json`),
      O.getOrElseW(() =>
        throwError(
          `Tried to change app language to non-existent locale '${locale}'`
        )
      )
    )()) as any
  ).default

  if (!i18nInstance) {
    throw new Error("Tried to change language without active i18n instance")
  }

  i18nInstance.global.setLocaleMessage(locale, localeData)

  // TODO: Look into the type issues here
  i18nInstance.global.locale.value = locale

  persistenceService.setLocalConfig("locale", locale)
}

/**
 * Returns the i18n instance
 */
export function getI18n() {
  return i18nInstance!.global.t
}

export default <HoppModule>{
  onVueAppInit(app) {
    const i18n = createI18n(<I18nOptions>{
      locale: "en", // TODO: i18n system!
      fallbackLocale: "en",
      legacy: false,
      allowComposition: true,
    })

    app.use(i18n)

    i18nInstance = i18n

    // Load in fallback lang messages
    i18nInstance.global.setLocaleMessage(
      FALLBACK_LANG_CODE,
      FALLBACK_LANG_MESSAGES
    )

    // TODO: Global loading state to hide the resolved lang loading
    const currentLocale = resolveCurrentLocale()
    changeAppLanguage(currentLocale)

    persistenceService.setLocalConfig("locale", currentLocale)
  },
  onBeforeRouteChange(to, _, router) {
    // Convert old locale path format to new format
    const oldLocalePathLangCode = APP_LANG_CODES.find((langCode) =>
      to.path.startsWith(`/${langCode}/`)
    )

    // Change language to the correct lang code
    if (oldLocalePathLangCode) {
      changeAppLanguage(oldLocalePathLangCode)

      router.replace(to.path.substring(`/${oldLocalePathLangCode}`.length))
    }
  },
}
