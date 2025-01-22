export function hasValidExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
  return allowedExtensions.includes(`.${ext.toLowerCase()}`)
}
