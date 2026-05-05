import { experimental_createMCPClient } from "ai";
import { validatePgUrl } from "@/lib/validate-pg-url";

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

interface Relationship {
  constraint: string;
  from: { table: string; column: string };
  to: { table: string; column: string };
}

interface SchemaPayload {
  tables: string[];
  columns: Record<string, Column[]>;
  relationships: Relationship[];
}

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
      { toolCallId: "schema", messages: [] }
    )) as { content?: Array<{ type: string; text?: string }> };

    const first = result?.content?.[0];
    const text = first?.type === "text" ? first.text ?? "" : "";
    if (!text) {
      return jsonResult({ ok: false, error: "Empty response from MCP." }, 502);
    }

    let parsed: SchemaPayload;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResult({ ok: false, error: "Could not parse schema response." }, 502);
    }

    if (typeof (parsed as unknown as { error?: string })?.error === "string") {
      return jsonResult({ ok: false, error: (parsed as unknown as { error: string }).error }, 200);
    }

    return jsonResult({ ok: true, schema: parsed }, 200);
  } catch (error) {
    return jsonResult(
      { ok: false, error: error instanceof Error ? error.message : "Schema fetch failed." },
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
