import { invoke } from '@tauri-apps/api/core'

/**
 * Options for downloading an app bundle
 */
export interface DownloadOptions {
  /**
   * URL from which to download the app bundle
   */
  url: string
  /**
   * Optional name to save the bundle as
   */
  name?: string
}

/**
 * Response from a download operation
 */
export interface DownloadResponse {
  /**
   * Whether the download was successful
   */
  success: boolean
  /**
   * Path where the bundle was saved
   */
  path: string
}

/**
 * Options for configuring how the app window appears
 */
export interface WindowOptions {
  /**
   * Window title
   * @default "Hoppscotch"
   */
  title?: string
  /**
   * Initial window width
   * @default 800
   */
  width?: number
  /**
   * Initial window height
   * @default 600
   */
  height?: number
  /**
   * Whether window should be resizable
   * @default true
   */
  resizable?: boolean
}

/**
 * Options for loading an app
 */
export interface LoadOptions {
  /**
   * Name of the app to load
   */
  name: string
  /**
   * Whether to load in current window
   */
  inline?: boolean
  /**
   * Window configuration
   */
  window?: WindowOptions
}

/**
 * Response from a load operation
 */
export interface LoadResponse {
  /**
   * Whether the app was loaded successfully
   */
  success: boolean
  /**
   * Label of the created window
   */
  windowLabel: string
}

/**
 * Downloads an app bundle from a remote URL
 * @param options Download configuration options
 * @returns Promise resolving to download status and location
 * @example
 * ```typescript
 * import { download } from '@tauri-apps/plugin-hoppscotch-appload'
 *
 * // Download an app bundle
 * const result = await download({
 *   url: 'https://example.com/app',
 *   name: 'my-app'
 * })
 * ```
 */
export async function download(options: DownloadOptions): Promise<DownloadResponse> {
  return await invoke<DownloadResponse>('plugin:hoppscotch-appload|download', {
    options,
  })
}

/**
 * Loads a previously downloaded app in a new window
 * @param options Load configuration options
 * @returns Promise resolving to load status and window info
 * @example
 * ```typescript
 * import { load } from '@tauri-apps/plugin-hoppscotch-appload'
 *
 * // Load an app in a new window
 * const result = await load({
 *   name: 'my-app',
 *   window: {
 *     title: 'My App',
 *     width: 1024,
 *     height: 768
 *   }
 * })
 * ```
 */
export async function load(options: LoadOptions): Promise<LoadResponse> {
  return await invoke<LoadResponse>('plugin:hoppscotch-appload|load', {
    options,
  })
}
