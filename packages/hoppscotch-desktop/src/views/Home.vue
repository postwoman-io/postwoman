<template>
  <div class="flex flex-col space-y-6 w-full max-w-md">
    <!-- Header -->
    <div class="flex flex-col items-center space-y-4">
      <img src="/logo.svg" alt="Hoppscotch" class="h-16 w-16" />
      <div class="flex flex-col items-center">
        <h1 class="text-xl font-semibold text-secondaryDark">Connect to Hoppscotch</h1>
        <p class="text-tiny text-secondary">Enter your server URL to get started</p>
      </div>
    </div>

    <!-- Connection Form -->
    <form @submit.prevent="handleConnect" class="flex flex-col space-y-4">
      <div class="flex flex-col space-y-2">
        <HoppSmartInput
          v-model="appUrl"
          :disabled="isLoading"
          placeholder="http://localhost:3000"
          :error="!!error"
          type="url"
          autofocus
          styles="bg-primaryLight border-divider text-secondaryDark"
          input-styles="floating-input peer w-full px-4 py-2 bg-primaryDark border border-divider rounded text-secondaryDark font-medium transition focus:border-dividerDark disabled:opacity-75"
          @submit="handleConnect"
        >
          <template #prefix>
            <IconLucideGlobe class="text-secondary" />
          </template>
          <template #suffix v-if="!isLoading && !error && appUrl">
            <IconLucideCheck class="text-green-500" />
          </template>
        </HoppSmartInput>
        <span v-if="error" class="text-red-500 text-tiny">{{ error }}</span>
      </div>

      <HoppButtonPrimary
        type="submit"
        :disabled="isLoading"
        :loading="isLoading"
        label="Connect"
        class="h-10"
      />

      <!-- Recent Connections -->
      <div v-if="recentUrls.length" class="flex flex-col">
        <div class="flex items-center gap-2 my-4">
          <div class="h-px bg-divider flex-1" />
          <span class="text-tiny text-secondary uppercase">Recent Connections</span>
          <div class="h-px bg-divider flex-1" />
        </div>

        <div class="flex flex-col space-y-0.5">
          <div
            v-for="item in recentUrls"
            :key="item.url"
            class="group relative flex items-center px-4 py-2 bg-primaryLight hover:bg-primaryDark rounded-lg"
          >
            <div
              class="flex-1 flex items-center cursor-pointer"
              :class="{ 'opacity-50': isLoading }"
              @click="appUrl = item.url"
            >
              <IconLucideServer class="opacity-75 mr-4" />
              <div class="flex flex-col flex-1 min-w-0">
                <div class="font-semibold truncate">{{ item.url }}</div>
                <p class="text-tiny text-secondary">{{ formatDate(item.lastUsed) }}</p>
                <span v-if="item.version" class="text-tiny text-secondary">v{{ item.version }}</span>
              </div>
            </div>

            <HoppButtonSecondary
              class="!p-2"
              :icon="item.pinned ? IconLucidePinOff : IconLucidePin"
              :disabled="isLoading"
              v-tippy="{
                content: item.pinned ? 'Unpin Connection' : 'Pin Connection',
                theme: 'tooltip'
              }"
              @click.stop="() => togglePin(item.url)"
            />
          </div>
        </div>

        <!-- Clear Unpinned -->
        <div v-if="hasUnpinnedUrls" class="flex justify-end mt-4">
          <HoppButtonSecondary
            :icon="IconLucideTrash2"
            label="Clear unpinned history"
            @click="clearUnpinned"
          />
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { Store } from '@tauri-apps/plugin-store'
import { download, load } from "@hoppscotch/plugin-appload"
import { toast } from "@hoppscotch/ui"
import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import * as A from 'fp-ts/Array'
import { HoppSmartInput } from "@hoppscotch/ui"
import { HoppButtonPrimary, HoppButtonSecondary } from "@hoppscotch/ui"
import IconLucideGlobe from "~icons/lucide/globe"
import IconLucideCheck from "~icons/lucide/check"
import IconLucideServer from "~icons/lucide/server"
import IconLucidePin from "~icons/lucide/pin"
import IconLucidePinOff from "~icons/lucide/pin-off"
import IconLucideTrash2 from "~icons/lucide/trash2"

const STORE_PATH = "hopp.store.json"
const MAX_HISTORY = 10

type RecentUrl = {
  url: string
  lastUsed: string
  version?: string
  pinned: boolean
}

// State
const store = ref<O.Option<Store>>(O.none)
const recentUrls = ref<RecentUrl[]>([])
const appUrl = ref("")
const error = ref("")
const isLoading = ref(false)

const hasUnpinnedUrls = computed(() =>
  recentUrls.value.some(item => !item.pinned)
)

// Utils
const normalizeUrl = (url: string): E.Either<Error, string> => pipe(
  E.tryCatch(
    () => {
      const withProtocol = url.startsWith("http") ? url : `http://${url}`
      const parsedUrl = new URL(withProtocol)
      if (!parsedUrl.port) parsedUrl.port = "3200"
      return parsedUrl.toString()
    },
    E.toError
  )
)

const formatDate = (date: string): string => {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day")
}

// Store Operations
const initStore = (): TE.TaskEither<Error, Store> => pipe(
  TE.tryCatch(
    async () => {
      const store = await Store.load(STORE_PATH)
      return store
    },
    E.toError
  )
)

const loadRecentUrls = (storeInstance: Store): TE.TaskEither<Error, RecentUrl[]> => pipe(
  TE.tryCatch(
    () => storeInstance.get<RecentUrl[]>('recentUrls'),
    E.toError
  ),
  TE.map(urls => urls ?? [])
)

const saveRecentUrls = (storeInstance: Store, urls: RecentUrl[]): TE.TaskEither<Error, RecentUrl[]> => pipe(
  TE.tryCatch(
    async () => {
      await storeInstance.set('recentUrls', urls)
      await storeInstance.save()
      return urls
    },
    E.toError
  )
)

const addToHistory = (storeInstance: Store, url: string, version?: string): TE.TaskEither<Error, void> => {
  const timestamp = new Date().toISOString()
  const currentUrls = recentUrls.value
  const existingIndex = currentUrls.findIndex(item => item.url === url)

  const newUrls = existingIndex !== -1
    ? pipe(
        currentUrls,
        urls => {
          const updated = [...urls]
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastUsed: timestamp,
            version: version ?? updated[existingIndex].version
          }
          return updated
        }
      )
    : pipe(
        [
          { url, lastUsed: timestamp, version, pinned: false },
          ...currentUrls
        ],
        urls => urls.length > MAX_HISTORY
          ? pipe(
              urls,
              A.filter((_, i) => i < MAX_HISTORY)
            )
          : urls
      )

  return pipe(
    saveRecentUrls(storeInstance, newUrls),
    TE.map(urls => {
      recentUrls.value = urls
    })
  )
}

const togglePin = async (url: string) => {
  await pipe(
    store.value,
    O.fold(
      () => TE.left(new Error("Store not initialized")),
      storeInstance => pipe(
        recentUrls.value,
        urls => urls.map(item =>
          item.url === url ? { ...item, pinned: !item.pinned } : item
        ),
        urls => saveRecentUrls(storeInstance, urls),
        TE.map(urls => {
          recentUrls.value = urls
          const isPinned = urls.find(i => i.url === url)?.pinned
          toast.success(isPinned ? "Connection pinned" : "Connection unpinned")
        })
      )
    ),
    TE.mapLeft(err => {
      console.error('Failed to toggle pin:', err)
      toast.error('Failed to toggle pin')
    })
  )()
}

const clearUnpinned = async () => {
  await pipe(
    store.value,
    O.fold(
      () => TE.left(new Error("Store not initialized")),
      storeInstance => pipe(
        recentUrls.value,
        urls => urls.filter(item => item.pinned),
        urls => saveRecentUrls(storeInstance, urls),
        TE.map(urls => {
          recentUrls.value = urls
          toast.success('Cleared unpinned connections')
        })
      )
    ),
    TE.mapLeft(err => {
      console.error('Failed to clear unpinned:', err)
      toast.error('Failed to clear unpinned')
    })
  )()
}

const handleConnect = async () => {
  if (!appUrl.value) {
    error.value = "Please enter a server URL"
    return
  }

  isLoading.value = true
  error.value = ""

  await pipe(
    normalizeUrl(appUrl.value),
    TE.fromEither,
    TE.chain(url => TE.tryCatch(
      () => download({ serverUrl: url }),
      E.toError
    )),
    TE.chain(downloadRes => pipe(
      TE.tryCatch(
        () => load({
          bundleName: downloadRes.bundleName,
          inline: false,
          window: {
            title: "Hoppscotch",
            width: 1200,
            height: 800,
            resizable: true
          }
        }),
        E.toError
      ),
      TE.chain(loadRes => pipe(
        store.value,
        O.fold(
          () => TE.left(new Error("Store not initialized")),
          storeInstance => loadRes.success
            ? pipe(
                addToHistory(storeInstance, appUrl.value, downloadRes.version),
                TE.map(() => {
                  appUrl.value = ""
                  error.value = ""
                })
              )
            : TE.left(new Error("Failed to load app"))
        )
      ))
    )),
    TE.mapLeft(err => {
      error.value = err.message
      toast.error(error.value)
    })
  )()

  isLoading.value = false
}

onMounted(() => {
  pipe(
    initStore(),
    TE.chain(storeInstance => pipe(
      loadRecentUrls(storeInstance),
      TE.map(urls => {
        store.value = O.some(storeInstance)
        recentUrls.value = urls
      })
    )),
    TE.mapLeft(err => {
      console.error('Failed to initialize store:', err)
      toast.error('Failed to load connection history')
    })
  )()
})
</script>
