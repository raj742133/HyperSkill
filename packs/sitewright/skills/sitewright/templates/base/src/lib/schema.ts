/**
 * The schema, as a module rather than a .sql file read at runtime: a serverless bundle only contains files reached through
 * `import`, and a path built at runtime is invisible to Next's file tracing.
 *
 * Assembled by Sitewright from the modules you chose. Every statement is CREATE ... IF NOT EXISTS, so applying it on every
 * cold start is safe and saves a migration tool. To change a table later, ADD COLUMN IF NOT EXISTS - never edit a
 * CREATE TABLE of a database that already exists.
 */
export const SCHEMA_SQL = `
__SCHEMA_SQL__
`;
