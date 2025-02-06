import { invoke } from '@tauri-apps/api/core';

async function download(options) {
    return await invoke('plugin:appload|download', { options });
}
async function load(options) {
    return await invoke('plugin:appload|load', { options });
}
async function clear() {
    return await invoke('plugin:appload|clear');
}

export { clear, download, load };
