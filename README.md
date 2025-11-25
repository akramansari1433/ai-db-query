# AI Database Query

A Next.js application that enables natural language database queries powered by AI. Ask questions in plain English and get results displayed as interactive tables or charts.

## Features

- **Natural Language Queries**: Query your database using plain English instead of SQL
- **Dual View Modes**:
  - **Table View**: Display query results in a structured table format
  - **Chart View**: Visualize data with interactive bar charts
- **AI-Powered SQL Generation**: Uses Groq's LLM to automatically generate and execute SQL queries
- **PostgreSQL Integration**: Connects to PostgreSQL databases via MCP (Model Context Protocol)
- **Smart Query Execution**: Automatically analyzes table schemas and handles query retries on failures
- **Modern UI**: Built with Next.js 15, React 19, and Tailwind CSS with shadcn/ui components

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 4
- **AI/LLM**: Groq API with Llama 3.3 70B model
- **Charts**: Recharts
- **Database**: PostgreSQL (via Neon)
- **MCP Integration**: Server-Sent Events (SSE) for database tool access

## Prerequisites

- Node.js 20+ installed
- A Groq API key ([Get one here](https://console.groq.com))
- A PostgreSQL database (the app uses Neon, but any PostgreSQL database works)
- An MCP server providing database tools (configured at `https://ai-db-query.akramansari1433.workers.dev/sse`)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-db-query
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```bash
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
GROQ_API_KEY="your_groq_api_key_here"
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Table View
1. Select the "Table View" tab
2. Enter a natural language query like:
   - "get all users"
   - "show me orders from last month"
   - "list products with price greater than 100"
3. Press Enter or click the "Query" button
4. View results in a structured table

### Chart View
1. Select the "Chart View" tab
2. Enter a query that returns data suitable for visualization:
   - "show user count by month"
   - "total sales per category"
   - "average rating by product"
3. Press Enter or click the "Query" button
4. View results as an interactive bar chart

## How It Works

1. **User Input**: You type a natural language query
2. **AI Processing**: The query is sent to Groq's Llama model via the AI SDK
3. **Schema Analysis**: The AI first retrieves your database schema using MCP tools
4. **SQL Generation**: Based on the schema, it generates appropriate SQL queries
5. **Query Execution**: The SQL is executed against your PostgreSQL database via MCP
6. **Result Display**: Data is formatted and displayed as a table or chart

## MCP Integration

This app uses the Model Context Protocol (MCP) to interact with the database through two main tools:

- `getTablesInfoPostgres`: Retrieves database schema information
- `queryDatabasePostgres`: Executes SQL queries

The MCP server is accessed via Server-Sent Events (SSE) at the configured endpoint.

## Project Structure

```
ai-db-query/
├── app/
│   ├── api/
│   │   └── completion/
│   │       └── route.ts          # API endpoint for AI query processing
│   ├── page.tsx                   # Main application UI
│   └── layout.tsx                 # Root layout
├── components/
│   └── ui/                        # shadcn/ui components
├── lib/
│   └── utils.ts                   # Utility functions
├── public/                        # Static assets
├── .env.local                     # Environment variables (not in git)
└── package.json                   # Dependencies
```

## API Routes

### POST `/api/completion`

Processes natural language queries and returns database results.

**Request Body:**
```json
{
  "prompt": "your natural language query",
  "type": "table" | "chart"
}
```

**Response:**
```json
{
  "success": true,
  "type": "table",
  "data": [...],
  "columns": [...]
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `GROQ_API_KEY` | Groq API key for LLM access | Yes |

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Deployment

### Deploy on Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables (`DATABASE_URL`, `GROQ_API_KEY`)
4. Deploy

### Other Platforms

This is a standard Next.js app and can be deployed to any platform supporting Node.js:
- AWS (Amplify, EC2, ECS)
- Google Cloud Run
- Railway
- Render
- Fly.io

## Customization

### Change the LLM Model

Edit [route.ts:80](app/api/completion/route.ts#L80):
```typescript
model: groq("llama-3.3-70b-versatile"),
```

Available Groq models include:
- `llama-3.3-70b-versatile`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

### Modify Chart Types

The app currently supports bar charts. To add other chart types, update the rendering logic in [page.tsx:101-144](app/page.tsx#L101-L144).

### Change MCP Server

Update the SSE URL in [route.ts:16](app/api/completion/route.ts#L16):
```typescript
url: "https://your-mcp-server.com/sse",
```

## Troubleshooting

### Query fails with table/column not found
- The AI automatically retrieves schema information, but complex queries may need refinement
- Try rephrasing your query with more specific details

### Charts not displaying
- Ensure your query returns at least 2 columns
- The first column is used for X-axis, second for Y-axis
- Numeric data works best for the Y-axis

### API errors
- Verify your `GROQ_API_KEY` is valid
- Check your MCP server is accessible
- Ensure `DATABASE_URL` is correctly formatted

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
