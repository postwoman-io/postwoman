import { invoke } from '@tauri-apps/api/core';

async function download(options) {
    return await invoke('plugin:hoppscotch-appload|download', { options });
}
async function load(options) {
    return await invoke('plugin:hoppscotch-appload|load', { options });
}

export { download, load };
