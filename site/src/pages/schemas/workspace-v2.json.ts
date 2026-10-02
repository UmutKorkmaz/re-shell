/**
 * Serves the workspace.yaml v2 JSON Schema at `<site>/schemas/workspace-v2.json`
 * (https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json).
 *
 * The schema is NOT copied into the site: this static endpoint reads the single
 * canonical source in the CLI package at build time and pins `$id` to the same
 * constant the CLI emits, so the hosted file can never drift from the CLI's.
 */
import type { APIRoute } from 'astro';
import canonicalSchema from '../../../../packages/cli/src/schemas/workspace-v2.schema.json';
import { SCHEMA_URL } from '../../../../packages/cli/src/constants/brand';

export const GET: APIRoute = () => {
  const published = { ...canonicalSchema, $id: SCHEMA_URL };
  return new Response(`${JSON.stringify(published, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/schema+json; charset=utf-8' },
  });
};
