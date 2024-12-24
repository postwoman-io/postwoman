import { invoke } from '@tauri-apps/api/core';

async function execute(request) {
    return await invoke('plugin:hoppscotch-relay|execute', { request });
}
async function cancel(requestId) {
    return await invoke('plugin:hoppscotch-relay|cancel', { requestId });
}

export { cancel, execute };
