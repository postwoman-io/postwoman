'use strict';

var core = require('@tauri-apps/api/core');

async function execute(request) {
    return await core.invoke('plugin:hoppscotch-relay|execute', { request });
}
async function cancel(requestId) {
    return await core.invoke('plugin:hoppscotch-relay|cancel', { requestId });
}

exports.cancel = cancel;
exports.execute = execute;
