import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "pg";
const { Pool } = pkg;

interface Env {
  DATABASE_URL: string;
}

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Demo",
    version: "1.0.0",
  });

  async init() {
    const pool = new Pool({
      connectionString: (this.env as Env).DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    this.server.tool("getTablesInfoPostgres", {}, async (_args, _extra) => {
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

      const columnsByTable = columnsRes.rows.reduce((acc, row) => {
        if (!acc[row.table_name]) {
          acc[row.table_name] = [];
        }
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
      {
        query: z.string(),
      },
      async ({ query }) => {
        await pool.connect();

        try {
          const result = await pool.query(query);
          return {
            content: [{ type: "text", text: JSON.stringify(result.rows) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
          };
        }
      }
    );
  }
}

export default MyMCP.mount("/sse");
