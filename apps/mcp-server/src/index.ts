import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "pg";
const { Pool } = pkg;

interface Props extends Record<string, unknown> {
  databaseUrl: string;
}

function isValidPgUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host === "0.0.0.0" || host === "::1") return false;
    if (
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^127\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|analyze|reindex|cluster|merge|call|do|listen|notify|lock)\b/i;
const STARTS_WITH_SELECT_OR_WITH = /^\s*(with\b|select\b)/i;

function ensureLimit(query: string): string {
  const trimmed = query.trim().replace(/;+\s*$/, "");
  if (/\blimit\s+\d+/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT 1000`;
}

export class MyMCP extends McpAgent<Cloudflare.Env, unknown, Props> {
  server = new McpServer({
    name: "ai-db-query",
    version: "1.0.0",
  });

  async init() {
    const databaseUrl = this.props?.databaseUrl;
    if (!databaseUrl) {
      throw new Error("Missing databaseUrl in session props");
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      statement_timeout: 10000,
      connectionTimeoutMillis: 5000,
      max: 3,
    });

    this.server.tool("getTablesInfoPostgres", {}, async () => {
      const tablesRes = await pool.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type   = 'BASE TABLE';
        `);

      const columnsRes = await pool.query(`
          SELECT
            table_name,
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position;
        `);

      const relsRes = await pool.query(`
          SELECT
            tc.constraint_name,
            tc.table_name   AS source_table,
            kcu.column_name AS source_column,
            ccu.table_name  AS target_table,
            ccu.column_name AS target_column
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema    = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema    = 'public';
        `);

      const tables = tablesRes.rows.map((r) => r.table_name);

      const columnsByTable = columnsRes.rows.reduce<Record<string, unknown[]>>((acc, row) => {
        if (!acc[row.table_name]) acc[row.table_name] = [];
        acc[row.table_name].push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === "YES",
          default: row.column_default,
        });
        return acc;
      }, {});

      const relationships = relsRes.rows.map((r) => ({
        constraint: r.constraint_name,
        from: { table: r.source_table, column: r.source_column },
        to: { table: r.target_table, column: r.target_column },
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tables, columns: columnsByTable, relationships }, null, 2),
          },
        ],
      };
    });

    this.server.tool(
      "queryDatabasePostgres",
      { query: z.string() },
      async ({ query }) => {
        if (!STARTS_WITH_SELECT_OR_WITH.test(query)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: only SELECT (or WITH ... SELECT) queries are allowed.",
              },
            ],
          };
        }
        if (FORBIDDEN_KEYWORDS.test(query)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: query contains forbidden keywords. Only read-only queries are allowed.",
              },
            ],
          };
        }

        const safeQuery = ensureLimit(query);
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SET TRANSACTION READ ONLY");
          const result = await client.query(safeQuery);
          await client.query("ROLLBACK");
          return {
            content: [{ type: "text", text: JSON.stringify(result.rows) }],
          };
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // ignore rollback failures
          }
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Error: ${message}` }],
          };
        } finally {
          client.release();
        }
      }
    );
  }
}

const inner = MyMCP.mount("/sse");

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/sse")) {
      return new Response("Not found", { status: 404 });
    }

    const dbUrl = request.headers.get("X-Database-URL");
    if (!dbUrl) {
      return new Response("Missing X-Database-URL header", { status: 400 });
    }
    if (!isValidPgUrl(dbUrl)) {
      return new Response("Invalid X-Database-URL header", { status: 400 });
    }

    (ctx as ExecutionContext & { props?: Props }).props = { databaseUrl: dbUrl };
    return inner.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
