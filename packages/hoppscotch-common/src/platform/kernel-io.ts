/**
 * Defines how to save a file to the user's filesystem.
 */
export type SaveFileWithDialogOptions = {
  /**
   * The data to be saved
   */
  data: string | ArrayBuffer

  /**
   * The suggested filename for the file. This name will be shown in the
   * save dialog by default when a save is initiated.
   */
  suggestedFilename: string

  /**
   * The content type mime type of the data to be saved.
   *
   * NOTE: The usage of this data might be platform dependent.
   * For example, this field is used in the web, but not in the desktop app.
   */
  contentType: string

  /**
   * Defines the filters (like in Windows, on the right side, where you can
   * select the file type) for the file dialog.
   *
   * NOTE: The usage of this data might be platform dependent.
   * For example, this field is used in the web, but not in the desktop app.
   */
  filters?: Array<{
    /**
     * The name of the filter (in Windows, if the filter looks
     * like "Images (*.png, *.jpg)", the name would be "Images")
     */
    name: string

    /**
     * The array of extensions that are supported, without the dot.
     */
    extensions: string[]
  }>
}

export type SaveFileResponse =
  | {
      /**
       * The implementation was unable to determine the status of the save operation.
       * This cannot be considered a success or a failure and should be handled as an uncertainity.
       * The browser standard implementation (std) returns this value as there is no way to
       * check if the user downloaded the file or not.
       */
      type: "unknown"
    }
  | {
      /**
       * The result is known and the user cancelled the save.
       */
      type: "cancelled"
    }
  | {
      /**
       * The result is known and the user saved the file.
       */
      type: "saved"

      /**
       * The full path of where the file was saved
       */
      path: string
    }

/**
 * Platform definitions for how to handle IO operations.
 */
export type KernelIO = {
  /**
   * Defines how to save a file to the user's filesystem.
   * The expected behaviour is for the browser to show a prompt to save the file.
   */
  saveFileWithDialog: (
    opts: SaveFileWithDialogOptions
  ) => Promise<SaveFileResponse>

  /**
   * Opens a link in the user's browser.
   * The expected behaviour is for the browser to open a new tab/window (for example in desktop app) with the given URL.
   * @param url The URL to open
   */
  openExternalLink: (url: string) => Promise<void>
}
