import { experimental_createMCPClient, ToolExecutionOptions } from "ai";
import { validatePgUrl } from "@/lib/validate-pg-url";

const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function jsonResult(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  if (!mcpServerUrl) {
    return jsonResult({ ok: false, error: "Server misconfigured: MCP_SERVER_URL not set." }, 500);
  }

  let body: { databaseUrl?: string; tableName?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResult({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const { databaseUrl, tableName, limit } = body;
  if (!databaseUrl || !tableName) {
    return jsonResult({ ok: false, error: "Missing databaseUrl or tableName." }, 400);
  }

  const urlCheck = validatePgUrl(databaseUrl);
  if (!urlCheck.ok) {
    return jsonResult({ ok: false, error: urlCheck.reason }, 400);
  }

  if (!VALID_NAME.test(tableName)) {
    return jsonResult({ ok: false, error: "Invalid table name." }, 400);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const query = `SELECT * FROM "${tableName}" LIMIT ${safeLimit}`;

  let client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
  try {
    client = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: mcpServerUrl,
        headers: { "X-Database-URL": databaseUrl },
      },
    });

    const tools = await client.tools();
    const queryTool = tools["queryDatabasePostgres"];
    if (!queryTool) {
      return jsonResult({ ok: false, error: "MCP server is missing queryDatabasePostgres tool." }, 502);
    }

    const result = (await queryTool.execute(
      { query },
      { toolCallId: "preview", messages: [] } as ToolExecutionOptions
    )) as { content?: Array<{ type: string; text?: string }> };

    const first = result?.content?.[0];
    const text = first?.type === "text" ? first.text ?? "" : "";
    if (!text) {
      return jsonResult({ ok: false, error: "Empty response from MCP." }, 502);
    }

    if (text.startsWith("Error:")) {
      return jsonResult({ ok: false, error: text.replace(/^Error:\s*/, "") }, 200);
    }

    let rows: Record<string, unknown>[];
    try {
      rows = JSON.parse(text);
    } catch {
      return jsonResult({ ok: false, error: "Could not parse preview rows." }, 502);
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return jsonResult({ ok: true, rows, columns }, 200);
  } catch (error) {
    return jsonResult(
      { ok: false, error: error instanceof Error ? error.message : "Preview failed." },
      200
    );
  } finally {
    try {
      await client?.close();
    } catch {
      // ignore
    }
  }
}
