import { HoppCollection } from "@hoppscotch/data";
import { entityReference } from "verzod";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  transformWorkspaceCollections,
  transformWorkspaceEnvironment,
} from "../../utils/workspace-access";
import {
  TRANSFORMED_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK,
  TRANSFORMED_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK,
  TRANSFORMED_ENVIRONMENT_MOCK,
  WORKSPACE_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK,
  WORKSPACE_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK,
  WORKSPACE_ENVIRONMENT_MOCK,
  WORKSPACE_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK,
} from "./fixtures/workspace-access.mock";

import TRANSFORMED_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK from "../e2e/fixtures/collections/multiple-child-collections-auth-headers-coll.json";

// Helper function to validate against `HoppCollection` schema and apply relevant migrations
const migrateCollections = (collections: unknown[]): HoppCollection[] => {
  const collectionSchemaParsedResult = z
    .array(entityReference(HoppCollection))
    .safeParse(collections);

  if (!collectionSchemaParsedResult.success) {
    throw new Error(
      `Incoming collections failed schema validation: ${JSON.stringify(collections, null, 2)}`
    );
  }

  return collectionSchemaParsedResult.data.map((collection) => {
    return {
      ...collection,
      folders: migrateCollections(collection.folders),
    };
  });
};

describe("workspace-access", () => {
  describe("transformWorkspaceCollection", () => {
    test("Successfully transforms collection data with deeply nested collections and authorization/headers set at each level to the `HoppCollection` format", () => {
      expect(
        transformWorkspaceCollections(
          WORKSPACE_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK
        )
      ).toEqual(TRANSFORMED_DEEPLY_NESTED_COLLECTIONS_WITH_AUTH_HEADERS_MOCK);
    });

    test("Successfully transforms collection data with multiple child collections and authorization/headers set at each level to the `HoppCollection` format", () => {
      const migratedCollections = migrateCollections([
        TRANSFORMED_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK,
      ]);

      expect(
        transformWorkspaceCollections(
          WORKSPACE_MULTIPLE_CHILD_COLLECTIONS_WITH_AUTH_HEADERS_MOCK
        )
      ).toEqual(migratedCollections);
    });

    test("Adds the default value for `auth` & `header` fields while transforming collections without authorization/headers set at certain levels", () => {
      expect(
        transformWorkspaceCollections(
          WORKSPACE_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK
        )
      ).toEqual(
        TRANSFORMED_COLLECTIONS_WITHOUT_AUTH_HEADERS_AT_CERTAIN_LEVELS_MOCK
      );
    });
  });

  describe("transformWorkspaceEnvironment", () => {
    test("Successfully transforms environment data conforming to the format received from the network call to the `HoppEnvironment` format", () => {
      expect(transformWorkspaceEnvironment(WORKSPACE_ENVIRONMENT_MOCK)).toEqual(
        TRANSFORMED_ENVIRONMENT_MOCK
      );
    });
  });
});
