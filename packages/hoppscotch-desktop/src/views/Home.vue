<template>
  <div class="flex flex-col space-y-6 w-full max-w-md">
    <div class="flex flex-col items-center space-y-4">
      <img src="/logo.svg" alt="Hoppscotch" class="h-16 w-16" />
      <div class="flex flex-col items-center">
        <h1 class="text-xl font-semibold text-secondaryDark">Connect to Hoppscotch</h1>
        <p class="text-tiny text-secondary">Enter your server URL to get started</p>
      </div>
    </div>

    <form @submit.prevent="handleConnect" class="flex flex-col space-y-4">
      <div class="flex flex-col space-y-2">
        <HoppSmartInput
          v-model="appUrl"
          :disabled="isLoading"
          placeholder="localhost"
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
      </div>
      <div class="flex items-center justify-between mt-4 pt-4 border-t border-divider">
        <div>
          <HoppButtonSecondary
            :icon="IconLucideTrash2"
            label="Clear unpinned history"
            @click="clearUnpinned"
          />
        </div>
        <HoppButtonSecondary
          :icon="IconLucideTrash2"
          label="Clear Cache"
          :loading="isClearingCache"
          :disabled="isClearingCache"
          class="!text-red-500 hover:!text-red-600"
          @click="handleClearCache"
          v-tippy="{
            content: 'Clear all cached bundles and temporary files',
            theme: 'tooltip'
          }"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { LazyStore } from '@tauri-apps/plugin-store';
import { download, load, clear } from "@hoppscotch/plugin-appload";
import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';

import IconLucideGlobe from "~icons/lucide/globe"
import IconLucideCheck from "~icons/lucide/check"
import IconLucideServer from "~icons/lucide/server"
import IconLucidePin from "~icons/lucide/pin"
import IconLucidePinOff from "~icons/lucide/pin-off"
import IconLucideTrash2 from "~icons/lucide/trash2"

const STORE_PATH = "hopp.store.json";
const MAX_HISTORY = 10;

interface RecentUrl {
  url: string;
  lastUsed: string;
  version: string;
  pinned: boolean;
}

const store = new LazyStore(STORE_PATH);
const recentUrls = ref<RecentUrl[]>([]);
const appUrl = ref("");
const error = ref("");
const isLoading = ref(false);
const isClearingCache = ref(false);

const normalizeUrl = (url: string): E.Either<Error, string> => pipe(
  E.tryCatch(
    () => {
      const withProtocol = url.startsWith("http") ? url : `http://${url}`;
      const parsedUrl = new URL(withProtocol);
      if (!parsedUrl.port) parsedUrl.port = "3200";
      return parsedUrl.toString();
    },
    (e) => e instanceof Error ? e : new Error(String(e))
  )
);

const formatDate = (date: string): string => pipe(
  new Date(date).getTime() - Date.now(),
  diff => Math.ceil(diff / (1000 * 60 * 60 * 24)),
  days => new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day")
);

const loadRecentUrls = async () => {
  const urls = await store.get<RecentUrl[]>("recentUrls") || [];
  recentUrls.value = urls.sort((a, b) =>
    b.pinned === a.pinned ? new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime() :
    b.pinned ? 1 : -1
  );
};

const saveRecentUrls = async () => {
  await store.set("recentUrls", recentUrls.value);
  await store.save();
};

const updateRecentUrl = (url: string, version: string) => {
  const existingIndex = recentUrls.value.findIndex(item => item.url === url);
  const newEntry: RecentUrl = {
    url,
    lastUsed: new Date().toISOString(),
    version,
    pinned: existingIndex >= 0 ? recentUrls.value[existingIndex].pinned : false
  };

  if (existingIndex >= 0) {
    recentUrls.value.splice(existingIndex, 1);
  }

  recentUrls.value.unshift(newEntry);

  if (!newEntry.pinned && recentUrls.value.length > MAX_HISTORY) {
    const unpinnedUrls = recentUrls.value.filter(item => !item.pinned);
    if (unpinnedUrls.length > MAX_HISTORY) {
      const lastUnpinned = unpinnedUrls[unpinnedUrls.length - 1];
      const lastIndex = recentUrls.value.findIndex(item => item.url === lastUnpinned.url);
      recentUrls.value.splice(lastIndex, 1);
    }
  }
};

const togglePin = async (url: string) => {
  const index = recentUrls.value.findIndex(item => item.url === url);
  if (index >= 0) {
    recentUrls.value[index].pinned = !recentUrls.value[index].pinned;
    await saveRecentUrls();
  }
};

const clearUnpinned = async () => {
  recentUrls.value = recentUrls.value.filter(item => item.pinned);
  await saveRecentUrls();
};

const handleClearCache = async () => {
  if (isClearingCache.value) return;

  isClearingCache.value = true;
  try {
    await clear();
  } catch (err) {
    console.error('Failed to clear cache:', err);
  } finally {
    isClearingCache.value = false;
  }
};

const handleConnect = async () => {
  if (!appUrl.value || isLoading.value) return;

  isLoading.value = true;
  error.value = "";

  try {
    const normalizedUrl = pipe(
      appUrl.value,
      normalizeUrl,
      E.getOrElseW(err => { throw err })
    );

    const downloadResp = await download({ serverUrl: normalizedUrl });
    if (!downloadResp.success) throw new Error("Failed to download bundle");

    updateRecentUrl(normalizedUrl, downloadResp.version);
    await saveRecentUrls();

    const loadResp = await load({ bundleName: downloadResp.bundleName, window: { title: "Hoppscotch" } });
    if (!loadResp.success) throw new Error("Failed to load bundle");
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await store.init();
  await loadRecentUrls();
});
</script>
