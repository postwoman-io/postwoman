import { toast } from "@hoppscotch/ui"
import { createGlobalState } from "@vueuse/core"

export const useToast = createGlobalState(() => {
    return {
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message),
        info: (message: string, action?: { text: string; fn: () => void }) =>
            toast.info(message, action ? { action } : undefined)
    }
})
