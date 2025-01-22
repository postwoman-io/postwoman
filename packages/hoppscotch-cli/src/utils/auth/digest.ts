import axios from "axios";
import { md5 } from "js-md5";

import { exceptionColors } from "../getters";

export interface DigestAuthParams {
  username: string;
  password: string;
  realm: string;
  nonce: string;
  endpoint: string;
  method: string;
  algorithm: string;
  qop: string;
  nc?: string;
  opaque?: string;
  cnonce?: string; // client nonce (optional but typically required in qop='auth')
  reqBody?: string;
}

export interface DigestAuthInfo {
  realm: string;
  nonce: string;
  qop: string;
  opaque?: string;
  algorithm: string;
}

// Utility function to parse Digest auth header values
const parseDigestAuthHeader = (
  header: string
): { [key: string]: string } | null => {
  const matches = header.match(/([a-z0-9]+)="([^"]+)"/gi);
  if (!matches) return null;

  const authParams: { [key: string]: string } = {};
  matches.forEach((match) => {
    const parts = match.split("=");
    authParams[parts[0]] = parts[1].replace(/"/g, "");
  });

  return authParams;
};

// Function to generate Digest Auth Header
export const generateDigestAuthHeader = async (params: DigestAuthParams) => {
  const {
    username,
    password,
    realm,
    nonce,
    endpoint,
    method,
    algorithm = "MD5",
    qop,
    nc = "00000001",
    opaque,
    cnonce,
    reqBody = "",
  } = params;

  const url = new URL(endpoint);
  const uri = url.pathname + url.search;

  // Generate client nonce if not provided
  const generatedCnonce = cnonce || md5(`${Math.random()}`);

  // Step 1: Hash the username, realm, password and any additional fields based on the algorithm
  const ha1 =
    algorithm === "MD5-sess"
      ? md5(
          `${md5(`${username}:${realm}:${password}`)}:${nonce}:${generatedCnonce}`
        )
      : md5(`${username}:${realm}:${password}`);

  // Step 2: Hash the method and URI
  const ha2 =
    qop === "auth-int"
      ? md5(`${method}:${uri}:${md5(reqBody)}`) // Entity body hash for `auth-int`
      : md5(`${method}:${uri}`);

  // Step 3: Compute the response hash
  const response = md5(
    `${ha1}:${nonce}:${nc}:${generatedCnonce}:${qop}:${ha2}`
  );

  // Build the Digest header
  let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm="${algorithm}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${generatedCnonce}"`;

  if (opaque) {
    authHeader += `, opaque="${opaque}"`;
  }

  return authHeader;
};

export const fetchInitialDigestAuthInfo = async (
  url: string,
  method: string,
  disableRetry: boolean
): Promise<DigestAuthInfo> => {
  try {
    const initialResponse = await axios.request({
      url,
      method,
      validateStatus: () => true, // Allow handling of all status codes
    });

    if (disableRetry) {
      throw new Error(
        `Received status: ${initialResponse.status}. Retry is disabled as specified, so no further attempts will be made.`
      );
    }

    // Check if the response status is 401 (which is expected in Digest Auth flow)
    if (initialResponse.status === 401) {
      const authHeaderEntry = Object.keys(initialResponse.headers).find(
        (header) => header.toLowerCase() === "www-authenticate"
      );

      const authHeader = authHeaderEntry
        ? (initialResponse.headers[authHeaderEntry] ?? null)
        : null;

      if (authHeader) {
        const authParams = parseDigestAuthHeader(authHeader);
        if (
          authParams &&
          authParams.realm &&
          authParams.nonce &&
          authParams.qop
        ) {
          return {
            realm: authParams.realm,
            nonce: authParams.nonce,
            qop: authParams.qop,
            opaque: authParams.opaque,
            algorithm: authParams.algorithm,
          };
        }
      }
      throw new Error(
        "Failed to parse authentication parameters from WWW-Authenticate header"
      );
    }

    throw new Error(`Unexpected response: ${initialResponse.status}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : error;

    console.error(
      exceptionColors.FAIL(
        `\n Error fetching initial digest auth info: ${errMsg} \n`
      )
    );
    throw error; // Re-throw the error to handle it further up the chain if needed
  }
};
