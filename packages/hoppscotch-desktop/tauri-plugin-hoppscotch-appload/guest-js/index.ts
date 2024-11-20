import { invoke } from '@tauri-apps/api/core'

/**
 * Options for downloading an app bundle
 */
export interface DownloadOptions {
  /**
   * URL of the bundle server
   */
  serverUrl: string
  /**
   * Optional name to save the bundle as. If not provided,
   * will be derived from the server URL
   */
  bundleName?: string
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
  /**
   * Server URL that was used for the download
   */
  serverUrl: string
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
 * Downloads an app bundle from a trusted server
 * @param options Download configuration options
 * @returns Promise resolving to download status and location
 * @throws Error if the server is not trusted or verification fails
 * @example
 * ```typescript
 * import { download } from '@tauri-apps/plugin-hoppscotch-appload'
 *
 * // Download an app bundle from a trusted server
 * try {
 *   const result = await download({
 *     serverUrl: 'https://bundles.example.com',
 *     bundleName: 'my-app'
 *   })
 *   console.log(`Bundle downloaded to ${result.path}`)
 * } catch (err) {
 *   console.error('Download failed:', err)
 *   // Handle untrusted server or other errors
 * }
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
