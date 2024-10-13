export default function (responseStatus: number) {
  if (responseStatus >= 100 && responseStatus < 200)
    return {
      name: "informational",
      className: "info-response",
    }

  if (responseStatus >= 200 && responseStatus < 300)
    return {
      name: "successful",
      className: "success-response",
    }

  if (responseStatus >= 300 && responseStatus < 400)
    return {
      name: "redirection",
      className: "redirect-response",
    }

  if (responseStatus >= 400 && responseStatus < 500)
    return {
      name: "client error",
      className: "critical-error-response",
    }

  if (responseStatus >= 500 && responseStatus < 600)
    return {
      name: "server error",
      className: "server-error-response",
    }

  // this object is a catch-all for when no other objects match and should always be last
  return {
    name: "unknown",
    className: "missing-data-response",
  }
}
