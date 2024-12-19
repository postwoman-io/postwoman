import { ref, reactive, computed } from "vue"
import { useFileDialog } from "@vueuse/core"

export interface CertFiles {
  pem_cert: File | null
  pem_key: File | null
  pfx: File | null
  ca: File[]
}

export interface CertPickerOptions {
  onPEMCertChange?: (file: File | null) => void
  onPEMKeyChange?: (file: File | null) => void
  onPFXChange?: (file: File | null) => void
  onCACertAdd?: (file: File) => void
  onCACertRemove?: (index: number) => void
}

export function useCertificatePicker(options: CertPickerOptions = {}) {
  const certFiles = reactive<CertFiles>({
    pem_cert: null,
    pem_key: null,
    pfx: null,
    ca: [],
  })

  const certType = ref<"pem" | "pfx">("pem")
  const pfxPassword = ref("")

  const pemCertPicker = useFileDialog({
    accept: ".pem,.crt",
    reset: true,
    multiple: false,
  })

  const pemKeyPicker = useFileDialog({
    accept: ".pem,.key",
    reset: true,
    multiple: false,
  })

  const pfxPicker = useFileDialog({
    accept: ".pfx,.p12",
    reset: true,
    multiple: false,
  })

  const caCertPicker = useFileDialog({
    accept: ".pem,.crt",
    reset: true,
    multiple: false,
  })

  function pickPEMCertificate() {
    pemCertPicker.onChange((files) => {
      const selectedFile = files?.item(0)
      if (selectedFile) {
        certFiles.pem_cert = selectedFile
        certFiles.pfx = null
        options.onPEMCertChange?.(selectedFile)
      }
      pemCertPicker.reset()
    })
    pemCertPicker.open()
  }

  function pickPEMKey() {
    pemKeyPicker.onChange((files) => {
      const selectedFile = files?.item(0)
      if (selectedFile) {
        certFiles.pem_key = selectedFile
        certFiles.pfx = null
        options.onPEMKeyChange?.(selectedFile)
      }
      pemKeyPicker.reset()
    })
    pemKeyPicker.open()
  }

  function pickPFXCertificate() {
    pfxPicker.onChange((files) => {
      const selectedFile = files?.item(0)
      if (selectedFile) {
        certFiles.pfx = selectedFile
        certFiles.pem_cert = null
        certFiles.pem_key = null
        options.onPFXChange?.(selectedFile)
      }
      pfxPicker.reset()
    })
    pfxPicker.open()
  }

  function pickCACertificate() {
    caCertPicker.onChange((files) => {
      const selectedFile = files?.item(0)
      if (selectedFile) {
        certFiles.ca.push(selectedFile)
        options.onCACertAdd?.(selectedFile)
      }
      caCertPicker.reset()
    })
    caCertPicker.open()
  }

  function removeCACertificate(index: number) {
    certFiles.ca.splice(index, 1)
    options.onCACertRemove?.(index)
  }

  function reset() {
    certFiles.pem_cert = null
    certFiles.pem_key = null
    certFiles.pfx = null
    certFiles.ca = []
    pfxPassword.value = ""
    certType.value = "pem"
  }

  const isValidCertConfig = computed(() =>
    certType.value === "pem"
      ? !!(certFiles.pem_cert && certFiles.pem_key)
      : !!(certFiles.pfx && pfxPassword.value)
  )

  return {
    certFiles,
    certType,
    pfxPassword,
    pickPEMCertificate,
    pickPEMKey,
    pickPFXCertificate,
    pickCACertificate,
    removeCACertificate,
    reset,
    isValidCertConfig,
  }
}
