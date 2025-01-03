import { Environment, HoppRESTRequest } from "@hoppscotch/data";
import { EffectiveHoppRESTRequest } from "../../../interfaces/request";
import { HoppCLIError } from "../../../types/errors";
import { getEffectiveRESTRequest } from "../../../utils/pre-request";

import "@relmify/vitest-fp-ts";

const DEFAULT_ENV = <Environment>{
  name: "name",
  variables: [
    {
      key: "HEADER",
      value: "parsed_header",
    },
    { key: "PARAM", value: "parsed_param" },
    { key: "TOKEN", value: "parsed_token" },
    { key: "BODY_PROP", value: "parsed_body_prop" },
    { key: "ENDPOINT", value: "https://parsed-endpoint.com" },
  ],
};

const DEFAULT_REQUEST = <HoppRESTRequest>{
  v: "1",
  name: "name",
  method: "GET",
  endpoint: "https://example.com",
  params: [],
  headers: [],
  preRequestScript: "",
  testScript: "",
  auth: {
    authActive: false,
    authType: "none",
  },
  body: {
    contentType: null,
    body: null,
  },
};

describe("getEffectiveRESTRequest", () => {
  let SAMPLE_REQUEST = Object.assign({}, DEFAULT_REQUEST);

  beforeEach(() => {
    SAMPLE_REQUEST = Object.assign({}, DEFAULT_REQUEST);
  });

  it("Endpoint, headers and params with unavailable ENV.", () => {
    SAMPLE_REQUEST.headers = [
      {
        key: "HEADER",
        value: "<<UNKNOWN>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.params = [
      {
        key: "PARAM",
        value: "<<UNKNOWN>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.endpoint = "<<UNKNOWN>>";

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [{ active: true, key: "HEADER", value: "" }],
      effectiveFinalParams: [{ active: true, key: "PARAM", value: "" }],
      effectiveFinalURL: "",
    });
  });

  it("Auth with unavailable ENV.", () => {
    SAMPLE_REQUEST.auth = {
      authActive: true,
      authType: "bearer",
      token: "<<UNKNOWN>>",
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [
        { active: true, key: "Authorization", value: "Bearer " },
      ],
    });
  });

  it("Body with unavailable ENV.", () => {
    SAMPLE_REQUEST.body = {
      contentType: "text/plain",
      body: "<<UNKNOWN>>",
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualLeft(<HoppCLIError>{
      code: "PARSING_ERROR",
    });
  });

  it("Request meta-data with available ENVs.", () => {
    SAMPLE_REQUEST.headers = [
      {
        key: "HEADER",
        value: "<<HEADER>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.params = [
      {
        key: "PARAM",
        value: "<<PARAM>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.endpoint = "<<ENDPOINT>>";
    SAMPLE_REQUEST.auth = {
      authActive: true,
      authType: "bearer",
      token: "<<TOKEN>>",
    };
    SAMPLE_REQUEST.body = {
      contentType: "text/plain",
      body: "<<BODY_PROP>>",
    };

    const vars = DEFAULT_ENV.variables;

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [
        { active: true, key: "HEADER", value: vars[0].value },
        {
          active: true,
          key: "Authorization",
          value: `Bearer ${vars[2].value}`,
        },
        { active: true, key: "content-type", value: "text/plain" },
      ],
      effectiveFinalParams: [
        { active: true, key: "PARAM", value: vars[1].value },
      ],
      effectiveFinalURL: vars[4].value,
      effectiveFinalBody: vars[3].value,
    });
  });
});
