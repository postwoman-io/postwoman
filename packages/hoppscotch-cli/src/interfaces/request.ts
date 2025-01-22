import { AxiosPromise, AxiosRequestConfig } from "axios";
import { HoppRESTRequest } from "@hoppscotch/data";

/**
 * Provides definition to object returned by createRequest.
 * @property {function} request Axios request promise, executed to get axios
 * response promise.
 * @property {string} path Path of request within collection file.
 * @property {string} name Name of request within collection
 * @property {string} testScript Stringified hoppscotch testScript, used while
 * running testRunner.
 */
export interface RequestStack {
  request: () => AxiosPromise<any>;
  path: string;
}

/**
 * Provides definition to axios request promise's request parameter.
 * @property {boolean} supported - Boolean check for supported or unsupported requests.
 */
export interface RequestConfig extends AxiosRequestConfig {
  displayUrl?: string;
}

export interface EffectiveHoppRESTRequest extends HoppRESTRequest {
  /**
   * The effective final URL.
   *
   * This contains path, params and environment variables all applied to it
   */
  effectiveFinalURL: string;
  effectiveFinalDisplayURL?: string;
  effectiveFinalHeaders: {
    key: string;
    value: string;
    active: boolean;
    description: string;
  }[];
  effectiveFinalParams: {
    key: string;
    value: string;
    active: boolean;
    description: string;
  }[];
  effectiveFinalBody: FormData | string | File | null;
}
