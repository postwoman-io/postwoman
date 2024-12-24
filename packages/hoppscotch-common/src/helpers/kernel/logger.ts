class Logger {
  private prefix = "[HELPERS|KERNEL]"

  debug(message: string, context?: object) {
    console.debug(`${this.prefix} Debug:`, message, context)
  }

  info(message: string, context?: object) {
    console.info(`${this.prefix} Info:`, message, context)
  }

  warn(message: string, context?: object) {
    console.warn(`${this.prefix} Warn:`, message, context)
  }

  error(message: string, error?: unknown) {
    console.error(`${this.prefix} Error:`, message, error)
  }
}

export const logger = new Logger()
