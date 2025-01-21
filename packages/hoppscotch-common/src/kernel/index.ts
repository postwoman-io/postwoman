import { KernelAPI } from "@hoppscotch/kernel"

export { Io } from "./io"
export { Relay } from "./relay"
export { Store } from "./store"

export const getModule = <K extends keyof KernelAPI>(
  name: K
): NonNullable<KernelAPI[K]> => {
  const kernel = window.__KERNEL__
  if (!kernel?.[name]) throw new Error(`Kernel ${name} not initialized`)
  return kernel[name]
}
