// import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// import OAuthProvider from "@cloudflare/workers-oauth-provider";
import mysql from "mysql2/promise";
import pkg from "pg";
const { Pool } = pkg;

interface Env {
  DATABASE_URL: string;
  MYSQL_DATABASE: string;
  MYSQL_HOST: string;
  MYSQL_PORT: number;
  MYSQL_USER: string;
  MYSQL_PASSWORD: string;
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

    const mysqlPool = mysql.createPool({
      connectionLimit: 10,
      port: (this.env as Env).MYSQL_PORT,
      host: (this.env as Env).MYSQL_HOST,
      user: (this.env as Env).MYSQL_USER,
      password: (this.env as Env).MYSQL_PASSWORD,
      database: (this.env as Env).MYSQL_DATABASE,
      waitForConnections: true,
      disableEval: true,
    });

    this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }));

    // ------------ MYSQL ------------

    //get tables info from mysql
    // this.server.tool("getTablesInfoMysql", {}, async () => {
    //   let conn;
    //   try {
    //     conn = await mysqlPool.getConnection();

    //     // sanity-check:
    //     await conn.execute("SELECT 1");

    //     // 1. list all tables
    //     const [tablesRows] = await conn.execute<mysql.RowDataPacket[]>(
    //       `SELECT TABLE_NAME
    //          FROM information_schema.tables
    //         WHERE table_schema = ?
    //           AND table_type   = 'BASE TABLE'`,
    //       [(this.env as Env).MYSQL_DATABASE || "myabode-tenant-1"]
    //     );

    //     // 2. get columns
    //     const [columnsRows] = await conn.execute<mysql.RowDataPacket[]>(
    //       `SELECT TABLE_NAME,
    //               COLUMN_NAME,
    //               DATA_TYPE,
    //               IS_NULLABLE,
    //               COLUMN_DEFAULT
    //          FROM information_schema.columns
    //         WHERE table_schema = ?
    //         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    //       [(this.env as Env).MYSQL_DATABASE || "myabode-tenant-1"]
    //     );

    //     // 3. foreign-key relationships
    //     const [relsRows] = await conn.execute<mysql.RowDataPacket[]>(
    //       `SELECT k.CONSTRAINT_NAME,
    //               k.TABLE_NAME,
    //               k.COLUMN_NAME,
    //               k.REFERENCED_TABLE_NAME,
    //               k.REFERENCED_COLUMN_NAME
    //          FROM information_schema.key_column_usage k
    //          JOIN information_schema.referential_constraints r
    //            ON k.CONSTRAINT_NAME   = r.CONSTRAINT_NAME
    //           AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
    //         WHERE k.CONSTRAINT_SCHEMA    = ?
    //           AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
    //       [(this.env as Env).MYSQL_DATABASE || "myabode-tenant-1"]
    //     );

    //     // map into JS objects
    //     const tables = tablesRows.map((r) => r.TABLE_NAME);
    //     const columnsByTable = columnsRows.reduce<Record<string, any[]>>((acc, r) => {
    //       acc[r.TABLE_NAME] = acc[r.TABLE_NAME] || [];
    //       acc[r.TABLE_NAME].push({
    //         name: r.COLUMN_NAME,
    //         type: r.DATA_TYPE,
    //         nullable: r.IS_NULLABLE === "YES",
    //         default: r.COLUMN_DEFAULT,
    //       });
    //       return acc;
    //     }, {});
    //     const relationships = relsRows.map((r) => ({
    //       constraint: r.CONSTRAINT_NAME,
    //       from: { table: r.TABLE_NAME, column: r.COLUMN_NAME },
    //       to: { table: r.REFERENCED_TABLE_NAME, column: r.REFERENCED_COLUMN_NAME },
    //     }));

    //     return {
    //       content: [
    //         {
    //           type: "text",
    //           text: JSON.stringify({ tables, columns: columnsByTable, relationships }, null, 2),
    //         },
    //       ],
    //     };
    //   } catch (err: any) {
    //     return {
    //       content: [
    //         {
    //           type: "text",
    //           text: JSON.stringify({ error: `Failed to introspect MySQL: ${err.message}` }),
    //         },
    //       ],
    //     };
    //   } finally {
    //     conn?.release();
    //   }
    // });

    //query database using mysql
    // this.server.tool("queryDatabaseMysql", { query: z.string() }, async ({ query }) => {
    //   try {
    //     // directly execute on the pool
    //     const [rows] = await mysqlPool.query(query);
    //     return {
    //       content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    //     };
    //   } catch (error: any) {
    //     return {
    //       content: [{ type: "text", text: `Error: ${error.message || error}` }],
    //     };
    //   }
    // });

    // ------------ POSTGRES ------------

    //get tables info from postgres
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

    //query database using postgres
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

// Export the OAuth handler as the default
// export default new OAuthProvider({
//   apiRoute: "/sse",
//   // TODO: fix these types
//   // @ts-ignore
//   apiHandler: MyMCP.mount("/sse"),
//   // @ts-ignore
//   defaultHandler: app,
//   authorizeEndpoint: "/authorize",
//   tokenEndpoint: "/token",
//   clientRegistrationEndpoint: "/register",
// });

export default MyMCP.mount("/sse");
