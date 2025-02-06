import { toast as sonner } from "@hoppscotch/ui"
import { markRaw } from "vue"
import WhatsNewDialog from "~/components/app/WhatsNewDialog.vue"
import { getService } from "~/modules/dioc"
import { PersistenceService } from "~/services/persistence"
import { version as hoppscotchCommonPkgVersion } from "./../../package.json"

export async function useWhatsNewDialog() {
  const persistenceService = getService(PersistenceService)

  const versionFromLocalStorage =
    await persistenceService.getLocalConfig("hopp_v")

  // Set new entry `hopp_v` under `localStorage` if not present
  if (!versionFromLocalStorage) {
    await persistenceService.setLocalConfig(
      "hopp_v",
      hoppscotchCommonPkgVersion
    )
    return
  }

  // Already on the latest version
  if (versionFromLocalStorage === hoppscotchCommonPkgVersion) {
    return
  }

  const getMajorVersion = (v: string) => v.split(".").slice(0, 2).join(".")

  const majorVersionFromLocalStorage = getMajorVersion(versionFromLocalStorage)
  const hoppscotchCommonPkgMajorVersion = getMajorVersion(
    hoppscotchCommonPkgVersion
  )

  // Skipping the minor version update. e.g. 2024.1.0 -> 2024.1.1
  // Checking major version update. e.g. 2024.1 -> 2024.2

  // Show the release notes during a major version update
  if (majorVersionFromLocalStorage !== hoppscotchCommonPkgMajorVersion) {
    setTimeout(async () => {
      const notesUrl = await getReleaseNotes(hoppscotchCommonPkgMajorVersion)

      if (notesUrl) {
        sonner.custom(markRaw(WhatsNewDialog), {
          componentProps: {
            notesUrl,
            version: hoppscotchCommonPkgVersion,
          },
          position: "bottom-left",
          style: {
            bottom: "15px",
            left: "30px",
          },
          duration: Infinity,
        })
      }
    }, 10000)
  }

  await persistenceService.setLocalConfig("hopp_v", hoppscotchCommonPkgVersion)
}

async function getReleaseNotes(v: string): Promise<string | undefined> {
  try {
    const { release_notes } = await fetch(
      `https://releases.hoppscotch.com/releases/${v}.json`
    ).then((res) => res.json())

    return release_notes
  } catch (_) {
    return undefined
  }
}
