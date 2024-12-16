import { HoppRESTRequestVariables } from "@hoppscotch/data"

export const filterActive = (
  headers: HoppRESTRequestVariables
): Record<string, string> => {
  return headers
    .filter((header) => header.active)
    .reduce(
      (acc, { key, value }) => ({
        ...acc,
        [key]: value,
      }),
      {}
    )
}
