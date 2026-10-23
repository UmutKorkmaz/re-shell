import { resolve } from 'node:path';
import type { DocumentNode, GraphQLError } from 'graphql';

interface CompositionService {
  name: string;
  url?: string;
  typeDefs: DocumentNode;
}
interface CompositionResult {
  errors?: readonly GraphQLError[];
  supergraphSdl?: string;
  hints?: readonly { toString(): string }[];
}

// The build bundles Apollo with a patched UUID dependency. Keep graphql external
// so composition and callers share graphql's schema and error constructors.
// Both src/bridge (tests) and dist/bridge resolve to the same generated artifact.
export const composeServices: (services: CompositionService[]) => CompositionResult = require(
  resolve(__dirname, '../../dist/vendor/apollo-composition.cjs')
).composeServices;
