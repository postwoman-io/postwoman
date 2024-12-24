import { ref, onMounted } from 'vue'
import { Store } from '@tauri-apps/plugin-store'
import type { RecentUrl } from '~/types'

const STORE_PATH = 'url-history.json'
const MAX_HISTORY = 10

export function useUrlHistory() {
  const recentUrls = ref<RecentUrl[]>([])
  const isLoading = ref(false)
  let store: Store | null = null

  async function loadHistory() {
    try {
      isLoading.value = true
      store = await Store.load(STORE_PATH)
      const urls = await store.get<RecentUrl[]>('recentUrls')
      recentUrls.value = urls ?? []
    } finally {
      isLoading.value = false
    }
  }

  async function addUrl(url: string, version?: string) {
    if (!store) return

    const timestamp = new Date().toISOString()
    const existingIndex = recentUrls.value.findIndex(item => item.url === url)

    if (existingIndex !== -1) {
      recentUrls.value[existingIndex].lastUsed = timestamp
      if (version) {
        recentUrls.value[existingIndex].version = version
      }
    } else {
      recentUrls.value.unshift({
        url,
        lastUsed: timestamp,
        version,
        pinned: false
      })

      if (recentUrls.value.length > MAX_HISTORY) {
        const unpinnedUrls = recentUrls.value.filter(item => !item.pinned)
        if (unpinnedUrls.length > 0) {
          const lastUnpinned = unpinnedUrls[unpinnedUrls.length - 1]
          recentUrls.value = recentUrls.value.filter(item => item !== lastUnpinned)
        }
      }
    }

    await store.set('recentUrls', recentUrls.value)
  }

  async function togglePin(url: string) {
    if (!store) return

    const item = recentUrls.value.find(item => item.url === url)
    if (item) {
      item.pinned = !item.pinned
      await store.set('recentUrls', recentUrls.value)
    }
  }

  async function clearHistory() {
    if (!store) return

    const pinnedUrls = recentUrls.value.filter(item => item.pinned)
    recentUrls.value = pinnedUrls
    await store.set('recentUrls', recentUrls.value)
  }

  onMounted(() => {
    loadHistory()
  })

  return {
    recentUrls,
    isLoading,
    addUrl,
    togglePin,
    clearHistory
  }
}
