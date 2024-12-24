import { ref } from 'vue'
import {
    download,
    load,
    type DownloadOptions,
    type DownloadResponse,
    type LoadOptions,
    type LoadResponse,
} from "@hoppscotch/plugin-appload"

export function useAppUpdates() {
    const isChecking = ref(false)
    const updateAvailable = ref(false)
    const updateError = ref('')
    const currentVersion = ref<string>()

    async function checkAndDownload(serverUrl: string): Promise<DownloadResponse> {
        isChecking.value = true
        updateError.value = ''
        updateAvailable.value = false

        try {
            const downloadResponse = await download({
                serverUrl
            })

            currentVersion.value = downloadResponse.version
            return downloadResponse
        } catch (error) {
            if (error instanceof Error) {
                updateError.value = error.message
                updateAvailable.value = true
            }
            throw error
        } finally {
            isChecking.value = false
        }
    }

    async function loadApp(bundleName: string): Promise<LoadResponse> {
        return await load({
            bundleName,
            inline: false,
            window: {
                title: 'Hoppscotch',
                width: 1200,
                height: 800,
                resizable: true
            }
        })
    }

    async function downloadUpdate(serverUrl: string): Promise<LoadResponse> {
        isChecking.value = true
        updateError.value = ''

        try {
            const downloadResponse = await download({
                serverUrl
            })

            const loadResponse = await loadApp(downloadResponse.bundleName)

            if (loadResponse.success) {
                updateAvailable.value = false
                currentVersion.value = downloadResponse.version
            }

            return loadResponse
        } catch (error) {
            if (error instanceof Error) {
                updateError.value = error.message
            }
            throw error
        } finally {
            isChecking.value = false
        }
    }

    return {
        isChecking,
        updateAvailable,
        updateError,
        currentVersion,
        checkAndDownload,
        downloadUpdate,
        loadApp
    }
}
