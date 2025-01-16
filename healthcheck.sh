curlCheck() {
  if ! curl -s --head "$1" | head -n 1 | grep -q "HTTP/1.[01] [23].."; then
    echo "URL request failed!"
    return 1
  else
    echo "URL request succeeded!"
    return 0
  fi
}

if [ "$ENABLE_SUBPATH_BASED_ACCESS" = "true" ]; then
  curlCheck "http://localhost:80/backend/ping" || exit 1
else
  curlCheck "http://localhost:3000" || exit 1
  curlCheck "http://localhost:3100" || exit 1
  curlCheck "http://localhost:3170/ping" || exit 1
fi
