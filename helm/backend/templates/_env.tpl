{{- define "env" -}}
- name: DATABASE_URL
  value: "postgresql://hoppscotch:hoppscotch@db:5432/hoppscotch"
- name: MAGIC_LINK_TOKEN_VALIDITY
  value: "3"
- name: JWT_SECRET
  value: 'secret12333'
- name: TOKEN_SALT_COMPLEXITY
  value: '10'
- name: REFRESH_TOKEN_VALIDITY
  value: '604800000'
- name: ACCESS_TOKEN_VALIDITY
  value: '86400000'
- name: SESSION_SECRET
  value: 'UNSECURED_SECRET'
- name: REDIRECT_URL
  value: 'http://localhost:3000'
- name: WHITELISTED_ORIGINS
  value: ""
- name: MAILER_SMTP_URL
  value: "smtp://relay.somemail.com:25"
- name: MAILER_ADDRESS_FROM
  value: '"Hopp Scotch" <hoppscotch@hoppscotch.io>'
- name: RATE_LIMIT_TTL
  value: '60'
- name: RATE_LIMIT_MAX
  value: '100'
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

