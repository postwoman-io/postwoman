import { invoke } from '@tauri-apps/api/core'

export interface DownloadOptions {
  serverUrl: string
}

export interface DownloadResponse {
  success: boolean
  bundleName: string
  serverUrl: string
  version: string
}

export interface WindowOptions {
  title?: string
  width?: number
  height?: number
  resizable?: boolean
}

export interface LoadOptions {
  bundleName: string
  inline?: boolean
  window?: WindowOptions
}

export interface LoadResponse {
  success: boolean
  windowLabel: string
}

export async function download(options: DownloadOptions): Promise<DownloadResponse> {
  return await invoke<DownloadResponse>('plugin:appload|download', { options })
}

export async function load(options: LoadOptions): Promise<LoadResponse> {
  return await invoke<LoadResponse>('plugin:appload|load', { options })
}

export async function clear(): Promise<void> {
  return await invoke('plugin:appload|clear')
}
