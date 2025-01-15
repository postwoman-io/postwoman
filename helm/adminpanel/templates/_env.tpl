{{- define "env" -}}
- name: VITE_ALLOWED_AUTH_PROVIDERS
  value: GOOGLE,GITHUB,MICROSOFT,EMAIL
- name: VITE_BASE_URL
  value: http://app.hoppscotch
- name: VITE_SHORTCODE_BASE_URL
  value: http://app.hoppscotch
- name: VITE_ADMIN_URL
  value: http://admin.hoppscotch
- name: VITE_BACKEND_GQL_URL
  value: http://backend.hoppscotch/graphql
- name: VITE_BACKEND_WS_URL
  value: ws://backend.hoppscotch/graphql
- name: VITE_BACKEND_API_URL
  value: http://backend.hoppscotch/v1
{{- end -}}