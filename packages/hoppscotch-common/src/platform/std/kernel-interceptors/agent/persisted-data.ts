import { z } from "zod"
import { defineVersion, createVersionedEntity, InferredEntity } from "verzod"

const Uint8 = z.number().int().gte(0).lte(255)

export const StoredCACert = z.object({
  filename: z.string().min(1),
  enabled: z.boolean(),
  certificate: z.array(Uint8),
})

const caCertStore_v1 = defineVersion({
  initial: true,
  schema: z.object({
    v: z.literal(1),
    certs: z.array(StoredCACert),
  }),
})

export const CACertStore = createVersionedEntity({
  latestVersion: 1,
  versionMap: {
    1: caCertStore_v1,
  },
  getVersion(data) {
    const result = caCertStore_v1.schema.safeParse(data)

    return result.success ? result.data.v : null
  },
})

export type CACertStore = InferredEntity<typeof CACertStore>

export const StoredClientCert = z.object({
  enabled: z.boolean(),
  domain: z.string().trim().min(1),
  cert: z.union([
    z.object({
      PEMCert: z.object({
        certificate_filename: z.string().min(1),
        certificate_pem: z.array(Uint8),

        key_filename: z.string().min(1),
        key_pem: z.array(Uint8),
      }),
    }),
    z.object({
      PFXCert: z.object({
        certificate_filename: z.string().min(1),
        certificate_pfx: z.array(Uint8),

        password: z.string(),
      }),
    }),
  ]),
})

export type StoredClientCert = z.infer<typeof StoredClientCert>

const clientCertsStore_v1 = defineVersion({
  initial: true,
  schema: z.object({
    v: z.literal(1),
    clientCerts: z.record(StoredClientCert),
  }),
})

export const ClientCertsStore = createVersionedEntity({
  latestVersion: 1,
  versionMap: {
    1: clientCertsStore_v1,
  },
  getVersion(data) {
    const result = clientCertsStore_v1.schema.safeParse(data)

    return result.success ? result.data.v : null
  },
})

export type ClientCertStore = InferredEntity<typeof ClientCertsStore>
