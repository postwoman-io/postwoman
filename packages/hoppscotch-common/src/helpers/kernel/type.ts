import { HoppRESTRequest } from "@hoppscotch/data"
import { HoppRESTResponseHeader } from "../types/HoppRESTResponse"

export type HoppRESTFormDataEntry = {
  key: string
  active: boolean
  contentType?: string
} & ({ isFile: true; value: Blob[] | null } | { isFile: false; value: string })

export enum DigestAlgorithm {
  MD5 = "MD5",
  SHA256 = "SHA-256",
  SHA512 = "SHA-512",
}

export class ContentTypeMapper {
  private static readonly mapping = {
    "application/json": "json",
    "application/ld+json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/plain": "text",
    "text/html": "text",
    "multipart/form-data": "multipart",
    "application/x-www-form-urlencoded": "urlencoded",
    "application/octet-stream": "binary",
  } as const

  static isValid(type: string): type is keyof typeof ContentTypeMapper.mapping {
    return type in this.mapping
  }
}

export interface ResponseMetadata {
  responseSize: number
  responseDuration: number
  timing?: {
    connect?: number
    tls?: number
    send?: number
    wait?: number
    receive?: number
  }
}

export interface ResponseData {
  headers: HoppRESTResponseHeader[]
  body: ArrayBuffer
  statusCode: number
  statusText: string
  meta: ResponseMetadata
  req: HoppRESTRequest
}
