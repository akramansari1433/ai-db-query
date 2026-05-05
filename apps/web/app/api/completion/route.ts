import { experimental_createMCPClient, generateText, ToolExecutionOptions } from "ai";
import { createGroq } from "@ai-sdk/groq";


const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  const { prompt, type }: { prompt: string; type: "table" | "chart" } = await req.json();

  try {
    const sseClient = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: "https://ai-db-query.akramansari1433.workers.dev/sse",
      },
    });

    const mcpTools = await sseClient.tools();

    // Wrap tools to handle null arguments (convert to empty object)
    const tools = Object.fromEntries(
      Object.entries(mcpTools).map(([name, tool]) => [
        name,
        {
          ...tool,
          execute: async (args: unknown, options: ToolExecutionOptions) => {
            // Convert null or undefined to empty object
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
            3. Convert the user's request into proper SQL, focusing on getting data suitable for visualization
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
            3. Convert the user's request into proper SQL, using the correct table and column names based on step 1
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

    // Close the client after use
    await sseClient.close();

    // Return the raw text directly as a JSON response
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing query:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Something went wrong with your query. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
