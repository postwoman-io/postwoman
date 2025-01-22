type FormDataEntry = {
  key: string
  contentType?: string
  value: string | Blob
}

export const toFormData = (values: FormDataEntry[]) => {
  const formData = new FormData()

  values.forEach(({ key, value, contentType }) => {
    if (contentType) {
      formData.append(
        key,
        new Blob([value], {
          type: contentType,
        }),
        key
      )

      return
    }

    formData.append(key, value)
  })

  return formData
}
