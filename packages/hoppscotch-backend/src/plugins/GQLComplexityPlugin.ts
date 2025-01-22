import { GraphQLSchemaHost } from '@nestjs/graphql';
import {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GraphQLError } from 'graphql';
import {
  ComplexityEstimatorArgs,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

const COMPLEXITY_LIMIT = 50;

@Plugin()
export class GQLComplexityPlugin implements ApolloServerPlugin {
  constructor(private gqlSchemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const { schema } = this.gqlSchemaHost;

    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            // Custom estimator for introspection fields
            (args: ComplexityEstimatorArgs) => {
              const fieldName = args.field.name;
              if (fieldName.startsWith('__')) {
                return 0; // Return 0 complexity for introspection fields
              }
              return;
            },
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });
        if (complexity > COMPLEXITY_LIMIT) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${COMPLEXITY_LIMIT}`,
          );
        }
        console.log('Query Complexity:', complexity);
      },
    };
  }
}
