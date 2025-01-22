import { v4 as uuidV4 } from "uuid"

/**
 * Generate a unique reference ID
 * @param prefix Prefix to add to the generated ID
 * @returns The generated reference ID
 */
export const generateUniqueRefId = (prefix = "") => {
  const timestamp = Date.now().toString(36)
  const randomPart = uuidV4()

  return `${prefix}_${timestamp}_${randomPart}`
}
