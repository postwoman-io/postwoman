'use strict';

var core = require('@tauri-apps/api/core');

async function download(options) {
    return await core.invoke('plugin:hoppscotch-appload|download', { options });
}
async function load(options) {
    return await core.invoke('plugin:hoppscotch-appload|load', { options });
}

exports.download = download;
exports.load = load;
