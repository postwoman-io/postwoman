import { Method, RelayRequest } from "@hoppscotch/kernel"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"
import {
  filterActive,
  transformAuth,
  transformContent,
} from "~/helpers/kernel/common"

export const RESTRequest = {
  async toRequest(request: EffectiveHoppRESTRequest): Promise<RelayRequest> {
    const auth = await transformAuth(request.auth)
    const content = await transformContent(request.body)

    const headers = filterActive(request.effectiveFinalHeaders)
    const params = filterActive(request.effectiveFinalParams)

    return {
      id: Date.now(),
      url: request.effectiveFinalURL,
      method: request.method.toUpperCase() as Method,
      version: "HTTP/1.1",
      headers,
      params,
      auth,
      content,
    }
  },
}
