'use strict';

var core = require('@tauri-apps/api/core');

exports.MediaType = void 0;
(function (MediaType) {
    MediaType["TEXT_PLAIN"] = "text/plain";
    MediaType["TEXT_HTML"] = "text/html";
    MediaType["TEXT_CSS"] = "text/css";
    MediaType["TEXT_CSV"] = "text/csv";
    MediaType["APPLICATION_JSON"] = "application/json";
    MediaType["APPLICATION_LD_JSON"] = "application/ld+json";
    MediaType["APPLICATION_XML"] = "application/xml";
    MediaType["TEXT_XML"] = "text/xml";
    MediaType["APPLICATION_FORM"] = "application/x-www-form-urlencoded";
    MediaType["APPLICATION_OCTET"] = "application/octet-stream";
    MediaType["MULTIPART_FORM"] = "multipart/form-data";
})(exports.MediaType || (exports.MediaType = {}));
async function execute(request) {
    return await core.invoke('plugin:relay|execute', { request });
}
async function cancel(requestId) {
    return await core.invoke('plugin:relay|cancel', { requestId });
}

exports.cancel = cancel;
exports.execute = execute;
