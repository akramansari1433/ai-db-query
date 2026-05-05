"use client";

import { useState, KeyboardEvent, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// Define the result interface
interface QueryResult {
  success: boolean;
  data?: Record<string, string | number | boolean | null>[];
  columns?: string[];
  error?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [rawOutput, setRawOutput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleQuery();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPrompt(e.target.value);
  };

  const handleQuery = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);
    setRawOutput("");

    try {
      const response = await fetch("/api/completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: activeTab,
          prompt,
        }),
      });

      const text = await response.text();
      setRawOutput(text);

      try {
        const data = JSON.parse(text);
        setResult(data);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => {
    if (!result?.success || !result.data || !result.columns) return null;

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((column, index) => (
                <TableHead key={index}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {result.columns!.map((column, colIndex) => (
                  <TableCell key={colIndex}>
                    {row[column] !== null && row[column] !== undefined ? String(row[column]) : "NULL"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderChart = () => {
    if (!result?.success || !result.data || !result.columns) return null;

    // For simplicity, we'll use the first column as X-axis and second column as Y-axis
    // You can make this more dynamic based on your needs
    const xAxisKey = result.columns[0];
    const yAxisKey = result.columns[1];

    const chartData = result.data.map((row) => ({
      name: String(row[xAxisKey]),
      value: Number(row[yAxisKey]) || 0,
    }));

    // Calculate dynamic width based on number of data points
    // Minimum 80px per bar to ensure x-axis labels are readable
    const minWidth = Math.max(800, chartData.length * 80);

    return (
      <div className="overflow-x-auto">
        <ChartContainer
          config={{
            value: {
              label: yAxisKey,
              color: "#2563eb",
            },
          }}
          className="h-[400px]"
          style={{ minWidth: `${minWidth}px` }}
        >
          <BarChart data={chartData} width={minWidth} height={400}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={60} />
            <YAxis />
            <ChartTooltip
              content={({ active, payload }) => (
                <ChartTooltipContent active={active} payload={payload} label={xAxisKey} />
              )}
            />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ChartContainer>
      </div>
    );
  };

  return (
    <main className="max-w-7xl mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Database Query</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "table" | "chart")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="chart">Chart View</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-2">
              <Input
                placeholder={`Enter your ${activeTab} query (e.g., ${
                  activeTab === "table" ? "'get all users'" : "'show user count by month'"
                })`}
                value={prompt}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
              />
              <Button onClick={handleQuery} disabled={loading}>
                {loading ? "Loading..." : "Query"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading && (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          )}

          {!loading && !result && rawOutput && (
            <div>
              <div className="text-red-500 mb-2">Could not parse the result as JSON:</div>
              <pre className="whitespace-pre-wrap font-mono bg-gray-100 p-4 rounded-md overflow-auto max-h-96">
                {rawOutput}
              </pre>
            </div>
          )}

          {!loading && result && !result.success && <div className="text-red-500 p-4">{result.error}</div>}

          {!loading && result && result.success && <div>{activeTab === "table" ? renderTable() : renderChart()}</div>}

          {!loading && result && result.success && (!result.data || !result.columns) && (
            <div className="p-4">Query executed successfully, but no data was returned.</div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
