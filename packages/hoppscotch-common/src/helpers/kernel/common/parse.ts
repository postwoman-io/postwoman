import { MediaType, RelayResponseBody } from "@hoppscotch/kernel"

export const parseJSON = (body: RelayResponseBody): unknown | null => {
  if (!body.mediaType?.includes(MediaType.APPLICATION_JSON)) return null

  try {
    const jsonString = new TextDecoder("utf-8")
      .decode(body.body)
      // @ts-ignore
      .replaceAll("\x00", "")
    return JSON.parse(jsonString)
  } catch {
    return null
  }
}
