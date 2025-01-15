import {
  CollectionSchemaVersion,
  Environment,
  EnvironmentSchemaVersion,
  HoppCollection,
  RESTReqSchemaVersion,
} from "@hoppscotch/data";

import {
  WorkspaceCollection,
  WorkspaceEnvironment,
} from "../../../utils/workspace-access";

export const WORKSPACE_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK: WorkspaceCollection[] =
  [
    {
      id: "clx1ldkzs005t10f8rp5u60q7",
      data: '{"auth":{"token":"BearerToken","authType":"bearer","authActive":true},"headers":[{"key":"X-Test-Header","value":"Set at root collection","active":true,"description":""}]}',
      title: "CollectionA",
      parentID: null,
      folders: [
        {
          id: "clx1ldkzs005v10f86b9wx4yc",
          data: '{"auth":{"authType":"inherit","authActive":true},"headers":[]}',
          title: "FolderA",
          parentID: "clx1ldkzs005t10f8rp5u60q7",
          folders: [
            {
              id: "clx1ldkzt005x10f8i0u5lzgj",
              data: '{"auth":{"key":"key","addTo":"HEADERS","value":"test-key","authType":"api-key","authActive":true},"headers":[{"key":"X-Test-Header","value":"Overriden at FolderB","active":true}]}',
              title: "FolderB",
              parentID: "clx1ldkzs005v10f86b9wx4yc",
              folders: [
                {
                  id: "clx1ldkzu005z10f880zx17bg",
                  data: '{"auth":{"authType":"inherit","authActive":true},"headers":[]}',
                  title: "FolderC",
                  parentID: "clx1ldkzt005x10f8i0u5lzgj",
                  folders: [],
                  requests: [
                    {
                      id: "clx1ldkzu006010f820vzy13v",
                      collectionID: "clx1ldkzu005z10f880zx17bg",
                      teamID: "clws3hg58000011o8h07glsb1",
                      title: "RequestD",
                      request:
                        '{"v":"3","auth":{"authType":"basic","password":"password","username":"username","authActive":true},"body":{"body":null,"contentType":null},"name":"RequestD","method":"GET","params":[],"headers":[{"key":"X-Test-Header","value":"Overriden at RequestD","active":true}],"endpoint":"https://echo.hoppscotch.io","testScript":"pw.test(\\"Overrides auth and headers set at the parent folder\\", ()=> {\\n    pw.expect(pw.response.body.headers[\\"x-test-header\\"]).toBe(\\"Overriden at RequestD\\");\\n  pw.expect(pw.response.body.headers[\\"authorization\\"]).toBe(\\"Basic dXNlcm5hbWU6cGFzc3dvcmQ=\\");\\n});","preRequestScript":"","requestVariables":[]}',
                    },
                  ],
                },
              ],
              requests: [
                {
                  id: "clx1ldkzt005y10f82dl8ni8d",
                  collectionID: "clx1ldkzt005x10f8i0u5lzgj",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "RequestC",
                  request:
                    '{"v":"3","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"RequestC","method":"GET","params":[],"headers":[],"endpoint":"https://echo.hoppscotch.io","testScript":"pw.test(\\"Correctly inherits auth and headers from the parent folder\\", ()=> {\\n    pw.expect(pw.response.body.headers[\\"x-test-header\\"]).toBe(\\"Overriden at FolderB\\");\\n  pw.expect(pw.response.body.headers[\\"key\\"]).toBe(\\"test-key\\");\\n});","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
          ],
          requests: [
            {
              id: "clx1ldkzs005w10f8pc2v2boh",
              collectionID: "clx1ldkzs005v10f86b9wx4yc",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "RequestB",
              request:
                '{"v":"3","id":"clpttpdq00003qp16kut6doqv","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"RequestB","method":"GET","params":[],"headers":[],"endpoint":"https://echo.hoppscotch.io","testScript":"pw.test(\\"Correctly inherits auth and headers from the parent folder\\", ()=> {\\n    pw.expect(pw.response.body.headers[\\"x-test-header\\"]).toBe(\\"Set at root collection\\");\\n  pw.expect(pw.response.body.headers[\\"authorization\\"]).toBe(\\"Bearer BearerToken\\");\\n});","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
      ],
      requests: [
        {
          id: "clx1ldkzs005u10f82xd5ho3l",
          collectionID: "clx1ldkzs005t10f8rp5u60q7",
          teamID: "clws3hg58000011o8h07glsb1",
          title: "RequestA",
          request: `{"v":"${RESTReqSchemaVersion}","id":"clpttpdq00003qp16kut6doqv","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"RequestA","method":"GET","params":[],"headers":[],"endpoint":"https://echo.hoppscotch.io","testScript":"pw.test(\\"Correctly inherits auth and headers from the root collection\\", ()=> {\\n    pw.expect(pw.response.body.headers[\\"x-test-header\\"]).toBe(\\"Set at root collection\\");\\n  pw.expect(pw.response.body.headers[\\"authorization\\"]).toBe(\\"Bearer BearerToken\\");\\n});","preRequestScript":"","requestVariables":[],"responses":{}}`,
        },
      ],
    },
  ];

export const TRANSFORMED_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK: HoppCollection[] =
  [
    {
      v: CollectionSchemaVersion,
      id: "clx1ldkzs005t10f8rp5u60q7",
      name: "CollectionA",
      folders: [
        {
          v: CollectionSchemaVersion,
          id: "clx1ldkzs005v10f86b9wx4yc",
          name: "FolderA",
          folders: [
            {
              v: CollectionSchemaVersion,
              id: "clx1ldkzt005x10f8i0u5lzgj",
              name: "FolderB",
              folders: [
                {
                  v: CollectionSchemaVersion,
                  id: "clx1ldkzu005z10f880zx17bg",
                  name: "FolderC",
                  folders: [],
                  requests: [
                    {
                      v: "3",
                      auth: {
                        authType: "basic",
                        password: "password",
                        username: "username",
                        authActive: true,
                      },
                      body: {
                        body: null,
                        contentType: null,
                      },
                      name: "RequestD",
                      method: "GET",
                      params: [],
                      headers: [
                        {
                          key: "X-Test-Header",
                          value: "Overriden at RequestD",
                          active: true,
                        },
                      ],
                      endpoint: "https://echo.hoppscotch.io",
                      testScript:
                        'pw.test("Overrides auth and headers set at the parent folder", ()=> {\n    pw.expect(pw.response.body.headers["x-test-header"]).toBe("Overriden at RequestD");\n  pw.expect(pw.response.body.headers["authorization"]).toBe("Basic dXNlcm5hbWU6cGFzc3dvcmQ=");\n});',
                      preRequestScript: "",
                      requestVariables: [],
                    },
                  ],
                  auth: {
                    authType: "inherit",
                    authActive: true,
                  },
                  headers: [],
                },
              ],
              requests: [
                {
                  v: "3",
                  auth: {
                    authType: "inherit",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "RequestC",
                  method: "GET",
                  params: [],
                  headers: [],
                  endpoint: "https://echo.hoppscotch.io",
                  testScript:
                    'pw.test("Correctly inherits auth and headers from the parent folder", ()=> {\n    pw.expect(pw.response.body.headers["x-test-header"]).toBe("Overriden at FolderB");\n  pw.expect(pw.response.body.headers["key"]).toBe("test-key");\n});',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                key: "key",
                addTo: "HEADERS",
                value: "test-key",
                authType: "api-key",
                authActive: true,
              },
              headers: [
                {
                  key: "X-Test-Header",
                  value: "Overriden at FolderB",
                  active: true,
                  description: "",
                },
              ],
            },
          ],
          requests: [
            {
              v: "3",
              id: "clpttpdq00003qp16kut6doqv",
              auth: {
                authType: "inherit",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "RequestB",
              method: "GET",
              params: [],
              headers: [],
              endpoint: "https://echo.hoppscotch.io",
              testScript:
                'pw.test("Correctly inherits auth and headers from the parent folder", ()=> {\n    pw.expect(pw.response.body.headers["x-test-header"]).toBe("Set at root collection");\n  pw.expect(pw.response.body.headers["authorization"]).toBe("Bearer BearerToken");\n});',
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            authType: "inherit",
            authActive: true,
          },
          headers: [],
        },
      ],
      requests: [
        {
          v: RESTReqSchemaVersion,
          id: "clpttpdq00003qp16kut6doqv",
          auth: {
            authType: "inherit",
            authActive: true,
          },
          body: {
            body: null,
            contentType: null,
          },
          name: "RequestA",
          method: "GET",
          params: [],
          headers: [],
          endpoint: "https://echo.hoppscotch.io",
          testScript:
            'pw.test("Correctly inherits auth and headers from the root collection", ()=> {\n    pw.expect(pw.response.body.headers["x-test-header"]).toBe("Set at root collection");\n  pw.expect(pw.response.body.headers["authorization"]).toBe("Bearer BearerToken");\n});',
          preRequestScript: "",
          requestVariables: [],
          responses: {},
        },
      ],
      auth: {
        token: "BearerToken",
        authType: "bearer",
        authActive: true,
      },
      headers: [
        {
          key: "X-Test-Header",
          value: "Set at root collection",
          active: true,
          description: "",
        },
      ],
    },
  ];

export const WORKSPACE_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK: WorkspaceCollection[] =
  [
    {
      id: "clx1f86hv000010f8szcfya0t",
      data: '{"auth":{"authType":"basic","password":"testpass","username":"testuser","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value set at the root collection","active":true},{"key":"Inherited-Header","value":"Inherited header at all levels","active":true}]}',
      title:
        "Multiple child collections with authorization & headers set at each level",
      parentID: null,
      folders: [
        {
          id: "clx1fjgah000110f8a5bs68gd",
          data: '{"auth":{"authType":"inherit","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-1","active":true}]}',
          title: "folder-1",
          parentID: "clx1f86hv000010f8szcfya0t",
          folders: [
            {
              id: "clx1fjwmm000410f8l1gkkr1a",
              data: '{"auth":{"authType":"inherit","authActive":true},"headers":[{"key":"key","value":"Set at folder-11","active":true}]}',
              title: "folder-11",
              parentID: "clx1fjgah000110f8a5bs68gd",
              folders: [],
              requests: [
                {
                  id: "clx1gjo1q000p10f8tc3x2u50",
                  collectionID: "clx1fjwmm000410f8l1gkkr1a",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-11-request",
                  request:
                    '{"v":"4","auth":{"authType":"inherit","password":"testpass","username":"testuser","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-11-request","method":"GET","params":[],"headers":[],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-1\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1fjyxm000510f8pv90dt43",
              data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-12","active":true},{"key":"key","value":"Set at folder-12","active":true}]}',
              title: "folder-12",
              parentID: "clx1fjgah000110f8a5bs68gd",
              folders: [],
              requests: [
                {
                  id: "clx1glkt5000u10f88q51ioj8",
                  collectionID: "clx1fjyxm000510f8pv90dt43",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-12-request",
                  request:
                    '{"v":"4","auth":{"authType":"none","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-12-request","method":"GET","params":[],"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-12-request","active":true},{"key":"key","value":"Overriden at folder-12-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(undefined)\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-12-request\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n  pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-12-request\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1fk1cv000610f88kc3aupy",
              data: '{"auth":{"token":"test-token","authType":"bearer","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-13","active":true},{"key":"key","value":"Set at folder-13","active":true}]}',
              title: "folder-13",
              parentID: "clx1fjgah000110f8a5bs68gd",
              folders: [],
              requests: [
                {
                  id: "clx1grfir001510f8c4ttiazq",
                  collectionID: "clx1fk1cv000610f88kc3aupy",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-13-request",
                  request:
                    '{"v":"4","auth":{"key":"api-key","addTo":"HEADERS","value":"api-key-value","authType":"basic","password":"testpass","username":"testuser","authActive":true,"grantTypeInfo":{"token":"","isPKCE":true,"clientID":"sfasfa","password":"","username":"","grantType":"AUTHORIZATION_CODE","authEndpoint":"asfafs","clientSecret":"sfasfasf","tokenEndpoint":"asfa","codeVerifierMethod":"S256"}},"body":{"body":null,"contentType":null},"name":"folder-13-request","method":"GET","params":[],"headers":[{"key":"Custom-Header-Request-Level","value":"New custom header added at the folder-13-request level","active":true},{"key":"key","value":"Overriden at folder-13-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level with new header addition\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-13\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n    pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-13-request\\")\\n  pw.expect(pw.response.body.headers[\\"Custom-Header-Request-Level\\"]).toBe(\\"New custom header added at the folder-13-request level\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
          ],
          requests: [
            {
              id: "clx1gebpx000k10f8andzw36z",
              collectionID: "clx1fjgah000110f8a5bs68gd",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "folder-1-request",
              request:
                '{"v":"4","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-1-request","method":"GET","params":[],"headers":[],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-1\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
        {
          id: "clx1fjk9o000210f8j0573pls",
          data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-2","active":true}]}',
          title: "folder-2",
          parentID: "clx1f86hv000010f8szcfya0t",
          folders: [
            {
              id: "clx1fk516000710f87sfpw6bo",
              data: '{"auth":{"authType":"inherit","authActive":true},"headers":[{"key":"key","value":"Set at folder-21","active":true}]}',
              title: "folder-21",
              parentID: "clx1fjk9o000210f8j0573pls",
              folders: [],
              requests: [
                {
                  id: "clx1hfegy001j10f8ywbozysk",
                  collectionID: "clx1fk516000710f87sfpw6bo",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-21-request",
                  request:
                    '{"v":"4","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-21-request","method":"GET","params":[],"headers":[],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(undefined)\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-2\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1fk72t000810f8gfwkpi5y",
              data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-22","active":true},{"key":"key","value":"Set at folder-22","active":true}]}',
              title: "folder-22",
              parentID: "clx1fjk9o000210f8j0573pls",
              folders: [],
              requests: [
                {
                  id: "clx1ibfre002k10f86brcb2aa",
                  collectionID: "clx1fk72t000810f8gfwkpi5y",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-22-request",
                  request:
                    '{"v":"4","auth":{"authType":"none","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-22-request","method":"GET","params":[],"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-22-request","active":true},{"key":"key","value":"Overriden at folder-22-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(undefined)\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-22-request\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n  pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-22-request\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1fk95g000910f8bunhaoo8",
              data: '{"auth":{"token":"test-token","authType":"bearer","password":"testpass","username":"testuser","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-23","active":true},{"key":"key","value":"Set at folder-23","active":true}]}',
              title: "folder-23",
              parentID: "clx1fjk9o000210f8j0573pls",
              folders: [],
              requests: [
                {
                  id: "clx1if4w6002n10f8xe4gnf0w",
                  collectionID: "clx1fk95g000910f8bunhaoo8",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-23-request",
                  request:
                    '{"v":"4","auth":{"authType":"basic","password":"testpass","username":"testuser","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-23-request","method":"GET","params":[],"headers":[{"key":"Custom-Header-Request-Level","value":"New custom header added at the folder-23-request level","active":true},{"key":"key","value":"Overriden at folder-23-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level with new header addition\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-23\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n    pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-23-request\\")\\n  pw.expect(pw.response.body.headers[\\"Custom-Header-Request-Level\\"]).toBe(\\"New custom header added at the folder-23-request level\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
          ],
          requests: [
            {
              id: "clx1hbtdj001g10f8y71y869s",
              collectionID: "clx1fjk9o000210f8j0573pls",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "folder-2-request",
              request:
                '{"v":"4","auth":{"authType":"none","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-2-request","method":"GET","params":[],"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-2-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(undefined)\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-2-request\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
        {
          id: "clx1fjmlq000310f86o4d3w2o",
          data: '{"auth":{"key":"testuser","addTo":"HEADERS","value":"testpass","authType":"basic","password":"testpass","username":"testuser","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-3","active":true}]}',
          title: "folder-3",
          parentID: "clx1f86hv000010f8szcfya0t",
          folders: [
            {
              id: "clx1iwq0p003e10f8u8zg0p85",
              data: '{"auth":{"authType":"inherit","authActive":true},"headers":[{"key":"key","value":"Set at folder-31","active":true}]}',
              title: "folder-31",
              parentID: "clx1fjmlq000310f86o4d3w2o",
              folders: [],
              requests: [
                {
                  id: "clx1ixdiv003f10f8j6ni375m",
                  collectionID: "clx1iwq0p003e10f8u8zg0p85",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-31-request",
                  request:
                    '{"v":"4","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-31-request","method":"GET","params":[],"headers":[],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-3\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1izut7003m10f894ip59zg",
              data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-32","active":true},{"key":"key","value":"Set at folder-32","active":true}]}',
              title: "folder-32",
              parentID: "clx1fjmlq000310f86o4d3w2o",
              folders: [],
              requests: [
                {
                  id: "clx1j01dg003n10f8e34khl6v",
                  collectionID: "clx1izut7003m10f894ip59zg",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-32-request",
                  request:
                    '{"v":"4","auth":{"authType":"none","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-32-request","method":"GET","params":[],"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-32-request","active":true},{"key":"key","value":"Overriden at folder-32-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(undefined)\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-32-request\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n  pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-32-request\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
            {
              id: "clx1j2ka9003q10f8cdbzpgpg",
              data: '{"auth":{"token":"test-token","authType":"bearer","password":"testpass","username":"testuser","authActive":true},"headers":[{"key":"Custom-Header","value":"Custom header value overriden at folder-33","active":true},{"key":"key","value":"Set at folder-33","active":true}]}',
              title: "folder-33",
              parentID: "clx1fjmlq000310f86o4d3w2o",
              folders: [],
              requests: [
                {
                  id: "clx1j361a003r10f8oly5m2n6",
                  collectionID: "clx1j2ka9003q10f8cdbzpgpg",
                  teamID: "clws3hg58000011o8h07glsb1",
                  title: "folder-33-request",
                  request:
                    '{"v":"4","auth":{"authType":"basic","password":"testpass","username":"testuser","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-33-request","method":"GET","params":[],"headers":[{"key":"Custom-Header-Request-Level","value":"New custom header added at the folder-33-request level","active":true},{"key":"key","value":"Overriden at folder-33-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level with new header addition\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-33\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n    pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Overriden at folder-33-request\\")\\n  pw.expect(pw.response.body.headers[\\"Custom-Header-Request-Level\\"]).toBe(\\"New custom header added at the folder-33-request level\\")\\n})","preRequestScript":"","requestVariables":[]}',
                },
              ],
            },
          ],
          requests: [
            {
              id: "clx1jk1nq004y10f8fhtxvs02",
              collectionID: "clx1fjmlq000310f86o4d3w2o",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "folder-3-request",
              request:
                '{"v":"4","auth":{"authType":"basic","password":"testpass","username":"testuser","authActive":true},"body":{"body":null,"contentType":null},"name":"folder-3-request","method":"GET","params":[],"headers":[{"key":"Custom-Header-Request-Level","value":"New custom header added at the folder-3-request level","active":true},{"key":"key","value":"Set at folder-3-request","active":true}],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits/overrides authorization/header set at the parent collection level with new header addition\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value overriden at folder-3\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n      pw.expect(pw.response.body.headers[\\"Key\\"]).toBe(\\"Set at folder-3-request\\")\\n  pw.expect(pw.response.body.headers[\\"Custom-Header-Request-Level\\"]).toBe(\\"New custom header added at the folder-3-request level\\")\\n})","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
      ],
      requests: [
        {
          id: "clx1g2pnv000b10f80f0oyp79",
          collectionID: "clx1f86hv000010f8szcfya0t",
          teamID: "clws3hg58000011o8h07glsb1",
          title: "root-collection-request",
          request: `{"v":"${RESTReqSchemaVersion}","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"root-collection-request","method":"GET","params":[],"headers":[],"endpoint":"https://httpbin.org/get","testScript":"// Check status code is 200\\npw.test(\\"Status code is 200\\", ()=> {\\n    pw.expect(pw.response.status).toBe(200);\\n});\\n\\npw.test(\\"Successfully inherits authorization/header set at the parent collection level\\", () => {\\n  pw.expect(pw.response.body.headers[\\"Authorization\\"]).toBe(\\"Basic dGVzdHVzZXI6dGVzdHBhc3M=\\")\\n  \\n  pw.expect(pw.response.body.headers[\\"Custom-Header\\"]).toBe(\\"Custom header value set at the root collection\\")\\n  pw.expect(pw.response.body.headers[\\"Inherited-Header\\"]).toBe(\\"Inherited header at all levels\\")\\n})","preRequestScript":"","requestVariables":[],"responses":{}}`,
        },
      ],
    },
  ];

export const TRANSFORMED_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK: HoppCollection[] =
  [
    {
      v: 6,
      id: "clx1f86hv000010f8szcfya0t",
      name: "Multiple child collections with authorization & headers set at each level",
      folders: [
        {
          v: 6,
          id: "clx1fjgah000110f8a5bs68gd",
          name: "folder-1",
          folders: [
            {
              v: 6,
              id: "clx1fjwmm000410f8l1gkkr1a",
              name: "folder-11",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "inherit",
                    password: "testpass",
                    username: "testuser",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-11-request",
                  method: "GET",
                  params: [],
                  headers: [],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-1")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "inherit",
                authActive: true,
              },
              headers: [
                {
                  key: "key",
                  value: "Set at folder-11",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1fjyxm000510f8pv90dt43",
              name: "folder-12",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "none",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-12-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header",
                      value:
                        "Custom header value overriden at folder-12-request",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-12-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe(undefined)\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-12-request")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n  pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-12-request")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "none",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-12",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-12",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1fk1cv000610f88kc3aupy",
              name: "folder-13",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    key: "api-key",
                    addTo: "HEADERS",
                    value: "api-key-value",
                    authType: "basic",
                    password: "testpass",
                    username: "testuser",
                    authActive: true,
                    grantTypeInfo: {
                      token: "",
                      isPKCE: true,
                      clientID: "sfasfa",
                      password: "",
                      username: "",
                      grantType: "AUTHORIZATION_CODE",
                      authEndpoint: "asfafs",
                      clientSecret: "sfasfasf",
                      tokenEndpoint: "asfa",
                      codeVerifierMethod: "S256",
                    },
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-13-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header-Request-Level",
                      value:
                        "New custom header added at the folder-13-request level",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-13-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level with new header addition", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-13")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n    pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-13-request")\n  pw.expect(pw.response.body.headers["Custom-Header-Request-Level"]).toBe("New custom header added at the folder-13-request level")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                token: "test-token",
                authType: "bearer",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-13",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-13",
                  active: true,
                  description: "",
                },
              ],
            },
          ],
          requests: [
            {
              v: "4",
              auth: {
                authType: "inherit",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "folder-1-request",
              method: "GET",
              params: [],
              headers: [],
              endpoint: "https://httpbin.org/get",
              testScript:
                '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-1")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            authType: "inherit",
            authActive: true,
          },
          headers: [
            {
              key: "Custom-Header",
              value: "Custom header value overriden at folder-1",
              active: true,
              description: "",
            },
          ],
        },
        {
          v: 6,
          id: "clx1fjk9o000210f8j0573pls",
          name: "folder-2",
          folders: [
            {
              v: 6,
              id: "clx1fk516000710f87sfpw6bo",
              name: "folder-21",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "inherit",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-21-request",
                  method: "GET",
                  params: [],
                  headers: [],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe(undefined)\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-2")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "inherit",
                authActive: true,
              },
              headers: [
                {
                  key: "key",
                  value: "Set at folder-21",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1fk72t000810f8gfwkpi5y",
              name: "folder-22",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "none",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-22-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header",
                      value:
                        "Custom header value overriden at folder-22-request",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-22-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe(undefined)\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-22-request")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n  pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-22-request")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "none",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-22",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-22",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1fk95g000910f8bunhaoo8",
              name: "folder-23",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "basic",
                    password: "testpass",
                    username: "testuser",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-23-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header-Request-Level",
                      value:
                        "New custom header added at the folder-23-request level",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-23-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level with new header addition", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-23")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n    pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-23-request")\n  pw.expect(pw.response.body.headers["Custom-Header-Request-Level"]).toBe("New custom header added at the folder-23-request level")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                token: "test-token",
                authType: "bearer",
                password: "testpass",
                username: "testuser",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-23",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-23",
                  active: true,
                  description: "",
                },
              ],
            },
          ],
          requests: [
            {
              v: "4",
              auth: {
                authType: "none",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "folder-2-request",
              method: "GET",
              params: [],
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-2-request",
                  active: true,
                },
              ],
              endpoint: "https://httpbin.org/get",
              testScript:
                '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe(undefined)\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-2-request")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            authType: "none",
            authActive: true,
          },
          headers: [
            {
              key: "Custom-Header",
              value: "Custom header value overriden at folder-2",
              active: true,
              description: "",
            },
          ],
        },
        {
          v: 6,
          id: "clx1fjmlq000310f86o4d3w2o",
          name: "folder-3",
          folders: [
            {
              v: 6,
              id: "clx1iwq0p003e10f8u8zg0p85",
              name: "folder-31",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "inherit",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-31-request",
                  method: "GET",
                  params: [],
                  headers: [],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-3")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "inherit",
                authActive: true,
              },
              headers: [
                {
                  key: "key",
                  value: "Set at folder-31",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1izut7003m10f894ip59zg",
              name: "folder-32",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "none",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-32-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header",
                      value:
                        "Custom header value overriden at folder-32-request",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-32-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe(undefined)\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-32-request")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n  pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-32-request")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                authType: "none",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-32",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-32",
                  active: true,
                  description: "",
                },
              ],
            },
            {
              v: 6,
              id: "clx1j2ka9003q10f8cdbzpgpg",
              name: "folder-33",
              folders: [],
              requests: [
                {
                  v: "4",
                  auth: {
                    authType: "basic",
                    password: "testpass",
                    username: "testuser",
                    authActive: true,
                  },
                  body: {
                    body: null,
                    contentType: null,
                  },
                  name: "folder-33-request",
                  method: "GET",
                  params: [],
                  headers: [
                    {
                      key: "Custom-Header-Request-Level",
                      value:
                        "New custom header added at the folder-33-request level",
                      active: true,
                    },
                    {
                      key: "key",
                      value: "Overriden at folder-33-request",
                      active: true,
                    },
                  ],
                  endpoint: "https://httpbin.org/get",
                  testScript:
                    '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level with new header addition", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-33")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n    pw.expect(pw.response.body.headers["Key"]).toBe("Overriden at folder-33-request")\n  pw.expect(pw.response.body.headers["Custom-Header-Request-Level"]).toBe("New custom header added at the folder-33-request level")\n})',
                  preRequestScript: "",
                  requestVariables: [],
                },
              ],
              auth: {
                token: "test-token",
                authType: "bearer",
                password: "testpass",
                username: "testuser",
                authActive: true,
              },
              headers: [
                {
                  key: "Custom-Header",
                  value: "Custom header value overriden at folder-33",
                  active: true,
                  description: "",
                },
                {
                  key: "key",
                  value: "Set at folder-33",
                  active: true,
                  description: "",
                },
              ],
            },
          ],
          requests: [
            {
              v: "4",
              auth: {
                authType: "basic",
                password: "testpass",
                username: "testuser",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "folder-3-request",
              method: "GET",
              params: [],
              headers: [
                {
                  key: "Custom-Header-Request-Level",
                  value:
                    "New custom header added at the folder-3-request level",
                  active: true,
                },
                {
                  key: "key",
                  value: "Set at folder-3-request",
                  active: true,
                },
              ],
              endpoint: "https://httpbin.org/get",
              testScript:
                '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits/overrides authorization/header set at the parent collection level with new header addition", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value overriden at folder-3")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n      pw.expect(pw.response.body.headers["Key"]).toBe("Set at folder-3-request")\n  pw.expect(pw.response.body.headers["Custom-Header-Request-Level"]).toBe("New custom header added at the folder-3-request level")\n})',
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            key: "testuser",
            addTo: "HEADERS",
            value: "testpass",
            authType: "basic",
            password: "testpass",
            username: "testuser",
            authActive: true,
          },
          headers: [
            {
              key: "Custom-Header",
              value: "Custom header value overriden at folder-3",
              active: true,
              description: "",
            },
          ],
        },
      ],
      requests: [
        {
          v: RESTReqSchemaVersion,
          auth: {
            authType: "inherit",
            authActive: true,
          },
          body: {
            body: null,
            contentType: null,
          },
          name: "root-collection-request",
          method: "GET",
          params: [],
          headers: [],
          endpoint: "https://httpbin.org/get",
          testScript:
            '// Check status code is 200\npw.test("Status code is 200", ()=> {\n    pw.expect(pw.response.status).toBe(200);\n});\n\npw.test("Successfully inherits authorization/header set at the parent collection level", () => {\n  pw.expect(pw.response.body.headers["Authorization"]).toBe("Basic dGVzdHVzZXI6dGVzdHBhc3M=")\n  \n  pw.expect(pw.response.body.headers["Custom-Header"]).toBe("Custom header value set at the root collection")\n  pw.expect(pw.response.body.headers["Inherited-Header"]).toBe("Inherited header at all levels")\n})',
          preRequestScript: "",
          requestVariables: [],
          responses: {},
        },
      ],
      auth: {
        authType: "basic",
        password: "testpass",
        username: "testuser",
        authActive: true,
      },
      headers: [
        {
          key: "Custom-Header",
          value: "Custom header value set at the root collection",
          active: true,
          description: "",
        },
        {
          key: "Inherited-Header",
          value: "Inherited header at all levels",
          active: true,
          description: "",
        },
      ],
    },
  ];

// Collections with `data` field set to `null` at certain levels
export const WORKSPACE_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK: WorkspaceCollection[] =
  [
    {
      id: "clx1kxvao005m10f8luqivrf1",
      data: null,
      title: "Collection with no authorization/headers set",
      parentID: null,
      folders: [
        {
          id: "clx1kygjt005n10f8m1nkhjux",
          data: null,
          title: "folder-1",
          parentID: "clx1kxvao005m10f8luqivrf1",
          folders: [],
          requests: [
            {
              id: "clx1kz2gk005p10f8ll7ztbnj",
              collectionID: "clx1kygjt005n10f8m1nkhjux",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "req1",
              request:
                '{"v":"4","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"req1","method":"GET","params":[],"headers":[],"endpoint":"https://echo.hoppscotch.io","testScript":"","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
        {
          id: "clx1kym98005o10f8qg17t9o2",
          data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Set at folder-2","active":true}]}',
          title: "folder-2",
          parentID: "clx1kxvao005m10f8luqivrf1",
          folders: [],
          requests: [
            {
              id: "clx1kz3m7005q10f8lw3v09l4",
              collectionID: "clx1kym98005o10f8qg17t9o2",
              teamID: "clws3hg58000011o8h07glsb1",
              title: "req2",
              request:
                '{"v":"4","auth":{"authType":"inherit","authActive":true},"body":{"body":null,"contentType":null},"name":"req2","method":"GET","params":[],"headers":[],"endpoint":"https://echo.hoppscotch.io","testScript":"","preRequestScript":"","requestVariables":[]}',
            },
          ],
        },
        {
          id: "clx1l2bu6005r10f8daynohge",
          data: null,
          title: "folder-3",
          parentID: "clx1kxvao005m10f8luqivrf1",
          folders: [],
          requests: [],
        },
        {
          id: "clx1l2eaz005s10f8loetbbeb",
          data: '{"auth":{"authType":"none","authActive":true},"headers":[{"key":"Custom-Header","value":"Set at folder-4","active":true}]}',
          title: "folder-4",
          parentID: "clx1kxvao005m10f8luqivrf1",
          folders: [],
          requests: [],
        },
      ],
      requests: [],
    },
  ];

export const TRANSFORMED_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK: HoppCollection[] =
  [
    {
      v: CollectionSchemaVersion,
      id: "clx1kxvao005m10f8luqivrf1",
      name: "Collection with no authorization/headers set",
      folders: [
        {
          v: CollectionSchemaVersion,
          id: "clx1kygjt005n10f8m1nkhjux",
          name: "folder-1",
          folders: [],
          requests: [
            {
              v: "4",
              auth: {
                authType: "inherit",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "req1",
              method: "GET",
              params: [],
              headers: [],
              endpoint: "https://echo.hoppscotch.io",
              testScript: "",
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            authType: "inherit",
            authActive: true,
          },
          headers: [],
        },
        {
          v: CollectionSchemaVersion,
          id: "clx1kym98005o10f8qg17t9o2",
          name: "folder-2",
          folders: [],
          requests: [
            {
              v: "4",
              auth: {
                authType: "inherit",
                authActive: true,
              },
              body: {
                body: null,
                contentType: null,
              },
              name: "req2",
              method: "GET",
              params: [],
              headers: [],
              endpoint: "https://echo.hoppscotch.io",
              testScript: "",
              preRequestScript: "",
              requestVariables: [],
            },
          ],
          auth: {
            authType: "none",
            authActive: true,
          },
          headers: [
            {
              key: "Custom-Header",
              value: "Set at folder-2",
              active: true,
              description: "",
            },
          ],
        },
        {
          v: CollectionSchemaVersion,
          id: "clx1l2bu6005r10f8daynohge",
          name: "folder-3",
          folders: [],
          requests: [],
          auth: {
            authType: "inherit",
            authActive: true,
          },
          headers: [],
        },
        {
          v: CollectionSchemaVersion,
          id: "clx1l2eaz005s10f8loetbbeb",
          name: "folder-4",
          folders: [],
          requests: [],
          auth: {
            authType: "none",
            authActive: true,
          },
          headers: [
            {
              key: "Custom-Header",
              value: "Set at folder-4",
              active: true,
              description: "",
            },
          ],
        },
      ],
      requests: [],
      auth: {
        authType: "inherit",
        authActive: true,
      },
      headers: [],
    },
  ];

export const WORKSPACE_ENVIRONMENT_MOCK: WorkspaceEnvironment = {
  id: "clwudd68q00079rufju8uo3on",
  teamID: "clws3hg58000011o8h07glsb1",
  name: "Response body sample",
  variables: [
    {
      key: "firstName",
      value: "John",
      secret: false,
    },
    {
      key: "lastName",
      value: "Doe",
      secret: false,
    },
    {
      key: "id",
      value: "7",
      secret: false,
    },
    {
      key: "fullName",
      value: "<<firstName>> <<lastName>>",
      secret: false,
    },
    {
      key: "recursiveVarX",
      value: "<<recursiveVarY>>",
      secret: false,
    },
    {
      key: "recursiveVarY",
      value: "<<salutation>>",
      secret: false,
    },
    {
      key: "salutation",
      value: "Hello",
      secret: false,
    },
    {
      key: "greetText",
      value: "<<salutation>> <<fullName>>",
      secret: false,
    },
  ],
};

export const TRANSFORMED_ENVIRONMENT_MOCK: Environment = {
  v: EnvironmentSchemaVersion,
  id: "clwudd68q00079rufju8uo3on",
  name: "Response body sample",
  variables: [
    {
      key: "firstName",
      value: "John",
      secret: false,
    },
    {
      key: "lastName",
      value: "Doe",
      secret: false,
    },
    {
      key: "id",
      value: "7",
      secret: false,
    },
    {
      key: "fullName",
      value: "<<firstName>> <<lastName>>",
      secret: false,
    },
    {
      key: "recursiveVarX",
      value: "<<recursiveVarY>>",
      secret: false,
    },
    {
      key: "recursiveVarY",
      value: "<<salutation>>",
      secret: false,
    },
    {
      key: "salutation",
      value: "Hello",
      secret: false,
    },
    {
      key: "greetText",
      value: "<<salutation>> <<fullName>>",
      secret: false,
    },
  ],
};
