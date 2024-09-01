import { createApp } from 'vue';
import urql, { createClient, cacheExchange, fetchExchange } from '@urql/vue';
import { authExchange } from '@urql/exchange-auth';
import App from './App.vue';

// STYLES
import '@hoppscotch/ui/style.css';
import '../assets/scss/styles.scss';
import '../assets/scss/tailwind.scss';
import '@fontsource-variable/inter';
import '@fontsource-variable/material-symbols-rounded';
import '@fontsource-variable/roboto-mono';
// END STYLES

import { HOPP_MODULES } from './modules';
import { auth } from './helpers/auth';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { GRAPHQL_UNAUTHORIZED } from './helpers/errors';

export function createHoppAdminApp(el: string | Element) {
  const app = createApp(App).use(
    urql,
    createClient({
      url: import.meta.env.VITE_BACKEND_GQL_URL,
      requestPolicy: 'network-only',
      fetchOptions: () => {
        return {
          credentials: 'include',
        };
      },
      exchanges: [
        cacheExchange,
        authExchange(async () => {
          return {
            addAuthToOperation(operation) {
              return operation;
            },

            async refreshAuth() {
              pipe(
                await auth.performAuthRefresh(),
                O.getOrElseW(() => auth.signOutUser(true))
              );
            },

            didAuthError(error, _operation) {
              return error.message === GRAPHQL_UNAUTHORIZED;
            },
          };
        }),
        fetchExchange,
      ],
    })
  );

  // Initialize auth
  auth.performAuthInit();

  // Initialize modules
  HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app));

  app.mount(el);
}

// Call the function to create and mount the app
// createHoppAdminApp();
