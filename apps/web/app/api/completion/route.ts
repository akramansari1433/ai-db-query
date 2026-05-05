import { experimental_createMCPClient, generateText, ToolExecutionOptions } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { validatePgUrl } from "@/lib/validate-pg-url";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  if (!mcpServerUrl) {
    return jsonError("Server misconfigured: MCP_SERVER_URL not set.", 500);
  }

  let body: { prompt?: string; type?: "table" | "chart"; databaseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const { prompt, type, databaseUrl } = body;
  if (!prompt || !type) {
    return jsonError("Missing prompt or type.", 400);
  }
  if (!databaseUrl) {
    return jsonError("Missing databaseUrl. Configure a connection in settings.", 400);
  }

  const urlCheck = validatePgUrl(databaseUrl);
  if (!urlCheck.ok) {
    return jsonError(`Invalid connection URL: ${urlCheck.reason}`, 400);
  }

  try {
    const sseClient = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: mcpServerUrl,
        headers: { "X-Database-URL": databaseUrl },
      },
    });

    const mcpTools = await sseClient.tools();

    const tools = Object.fromEntries(
      Object.entries(mcpTools).map(([name, tool]) => [
        name,
        {
          ...tool,
          execute: async (args: unknown, options: ToolExecutionOptions) => {
            const safeArgs = args ?? {};
            return tool.execute(safeArgs, options);
          },
        },
      ])
    );

    const systemPrompt =
      type === "chart"
        ? `You are an SQL query assistant specialized in generating data for charts. Follow these steps exactly in order:

            1. FIRST call the getTablesInfoPostgres tool to retrieve all available tables and their schemas
            2. Analyze the table schemas to understand relationships and available columns
            3. Convert the user's request into proper SQL, focusing on getting data suitable for visualization. Use only SELECT statements (read-only).
            4. Consider if JOINs are needed based on the relationships between tables
            5. Execute the SQL query using the queryDatabasePostgres tool
            6. If the query fails, fix any table or column name issues and retry once
            7. When the query succeeds, return a JSON object in this exact format:
                {
                  "success": true,
                  "type": "chart",
                  "data": [...rows from result...],
                  "columns": [...column names...],
                  "chartType": "bar" | "line" | "pie",
                  "xAxis": "column_name_for_x_axis",
                  "yAxis": "column_name_for_y_axis"
                }
            8. If all attempts fail, return: {"success":false,"error":"error message"}

            IMPORTANT: Output only the JSON object, no markdown or additional text.`
        : `You are an SQL query assistant. Follow these steps exactly in order:

            1. FIRST call the getTablesInfoPostgres tool to retrieve all available tables and their schemas
            2. Analyze the table schemas to understand relationships and available columns
            3. Convert the user's request into proper SQL, using the correct table and column names based on step 1. Use only SELECT statements (read-only).
            4. Consider if JOINs are needed based on the relationships between tables
            5. Execute the SQL query using the queryDatabasePostgres tool
            6. If the query fails, fix any table or column name issues and retry once
            7. When the query succeeds, return a JSON object in this exact format:
              {
                "success": true,
                "type": "table",
                "data": [...rows from result...],
                "columns": [...column names...]
              }
            8. If all attempts fail, return: {"success":false,"error":"error message"}

            IMPORTANT: Output only the JSON object, no markdown or additional text.`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      tools,
      prompt,
      system: systemPrompt,
      maxSteps: 10,
    });

    await sseClient.close();

    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing query:", error instanceof Error ? error.message : "unknown");
    return jsonError("Something went wrong with your query. Please try again.", 500);
  }
}
