import { experimental_createMCPClient } from "ai";
import { validatePgUrl } from "@/lib/validate-pg-url";

function jsonResult(payload: { ok: boolean; tableCount?: number; error?: string }, status: number) {
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

  let body: { databaseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResult({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const { databaseUrl } = body;
  if (!databaseUrl) {
    return jsonResult({ ok: false, error: "Missing databaseUrl." }, 400);
  }

  const urlCheck = validatePgUrl(databaseUrl);
  if (!urlCheck.ok) {
    return jsonResult({ ok: false, error: urlCheck.reason }, 400);
  }

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
    const introspect = tools["getTablesInfoPostgres"];
    if (!introspect) {
      return jsonResult({ ok: false, error: "MCP server is missing getTablesInfoPostgres tool." }, 502);
    }

    const result = (await introspect.execute(
      {},
      { toolCallId: "test-connection", messages: [] }
    )) as { content?: Array<{ type: string; text?: string }> };

    let tableCount = 0;
    try {
      const first = result?.content?.[0];
      const text = first?.type === "text" ? first.text ?? "" : "";
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.tables)) tableCount = parsed.tables.length;
        if (typeof parsed?.error === "string") {
          return jsonResult({ ok: false, error: parsed.error }, 200);
        }
      }
    } catch {
      // not JSON; fall through with 0 tables
    }

    return jsonResult({ ok: true, tableCount }, 200);
  } catch (error) {
    return jsonResult(
      { ok: false, error: error instanceof Error ? error.message : "Connection failed." },
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
