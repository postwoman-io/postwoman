import { AuthType, ContentType } from "@hoppscotch/kernel"
import { ContentTypeMapper } from "./type"
import { ContentHandlerFactory } from "./content"
import { EffectiveHoppRESTRequest } from "../utils/EffectiveURL"
import { logger } from "./logger"
import { AuthHandlerFactory } from "./auth"

export const convertArrayToRecord = <
  T extends { key: string; value: string; active: boolean },
>(
  items: ReadonlyArray<T>
): Record<string, string[]> => {
  return items
    .filter((item): item is T & { active: true } => item.active)
    .reduce<Record<string, string[]>>(
      (acc, { key, value }) => ({
        ...acc,
        [key]: [...(acc[key] ?? []), value],
      }),
      {}
    )
}

export async function convertContent(
  body: EffectiveHoppRESTRequest["body"],
  effectiveBody: FormData | string | null | File,
  method: string
): Promise<ContentType | null> {
  logger.info("Converting content", {
    contentType: body.contentType,
    method,
    effectiveBodyType: effectiveBody?.constructor.name,
  })

  if (!body.contentType || !effectiveBody) {
    if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase())) {
      return null
    }
    throw new Error("Content type required when body is present")
  }

  if (!ContentTypeMapper.isValid(body.contentType)) {
    throw new Error(`Unknown content type: ${body.contentType}`)
  }

  const handler = new ContentHandlerFactory().getHandler(body.contentType)
  console.log(effectiveBody)
  return handler.convert(effectiveBody)
}

export function convertAuth(auth: EffectiveHoppRESTRequest["auth"]): AuthType {
  logger.info("Converting authentication", {
    authType: auth.authType,
    authActive: auth.authActive,
  })

  if (!auth.authActive) return { kind: "none" }

  try {
    const handler = new AuthHandlerFactory().getHandler(auth.authType)
    return handler.convert(auth)
  } catch (error) {
    logger.error("Auth conversion failed", error)
    throw error
  }
}
