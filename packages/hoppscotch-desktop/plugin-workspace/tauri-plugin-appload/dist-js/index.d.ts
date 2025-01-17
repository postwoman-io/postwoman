export interface DownloadOptions {
    serverUrl: string;
}
export interface DownloadResponse {
    success: boolean;
    bundleName: string;
    serverUrl: string;
    version: string;
}
export interface WindowOptions {
    title?: string;
    width?: number;
    height?: number;
    resizable?: boolean;
}
export interface LoadOptions {
    bundleName: string;
    inline?: boolean;
    window?: WindowOptions;
}
export interface LoadResponse {
    success: boolean;
    windowLabel: string;
}
export declare function download(options: DownloadOptions): Promise<DownloadResponse>;
export declare function load(options: LoadOptions): Promise<LoadResponse>;
//# sourceMappingURL=index.d.ts.map