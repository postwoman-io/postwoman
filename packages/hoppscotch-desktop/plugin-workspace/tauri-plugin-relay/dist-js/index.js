import { invoke } from '@tauri-apps/api/core';

var MediaType;
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
})(MediaType || (MediaType = {}));
async function execute(request) {
    return await invoke('plugin:relay|execute', { request });
}
async function cancel(requestId) {
    return await invoke('plugin:relay|cancel', { requestId });
}

export { MediaType, cancel, execute };
