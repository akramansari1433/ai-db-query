"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionDialog } from "@/components/connection-dialog";
import { SchemaSidebar } from "@/components/schema-sidebar";
import { TableDetail } from "@/components/table-detail";
import { AIQueryPanel } from "@/components/ai-query-panel";
import { getConnectionUrl } from "@/lib/connection";
import { getHostLabel } from "@/lib/validate-pg-url";
import type { Schema } from "@/lib/types";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [connectionUrl, setConnectionUrlState] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ai" | "table">("ai");

  useEffect(() => {
    setConnectionUrlState(getConnectionUrl());
    setHydrated(true);
  }, []);

  const fetchSchema = useCallback(async (url: string) => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetch("/api/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: url }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSchemaError(data.error ?? "Could not load schema.");
        setSchema(null);
        return;
      }
      setSchema(data.schema as Schema);
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : "Network error.");
      setSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectionUrl) {
      fetchSchema(connectionUrl);
    } else {
      setSchema(null);
      setSelectedTable(null);
    }
  }, [connectionUrl, fetchSchema]);

  const handleSaved = (url: string) => setConnectionUrlState(url);
  const handleCleared = () => {
    setConnectionUrlState(null);
    setSchema(null);
    setSelectedTable(null);
  };

  const handleSelectTable = (name: string) => {
    setSelectedTable(name);
    setActiveTab("table");
  };

  const handleRefreshSchema = () => {
    if (connectionUrl) fetchSchema(connectionUrl);
  };

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  if (!connectionUrl) {
    return (
      <main className="flex min-h-screen flex-col">
        <Header connectionUrl={null} onOpenSettings={() => setSettingsOpen(true)} />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-md flex-col items-center gap-3 rounded-md border border-dashed p-10 text-center">
            <Database className="size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Connect a database</h2>
            <p className="text-sm text-muted-foreground">
              Add a PostgreSQL connection URL to browse tables and run AI-powered queries.
            </p>
            <Button onClick={() => setSettingsOpen(true)}>Connect database</Button>
          </div>
        </div>
        <ConnectionDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={handleSaved}
          onCleared={handleCleared}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Header connectionUrl={connectionUrl} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 md:block">
          <SchemaSidebar
            schema={schema}
            selectedTable={selectedTable}
            onSelect={handleSelectTable}
            onRefresh={handleRefreshSchema}
            loading={schemaLoading}
            error={schemaError}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "ai" | "table")}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="ai">Ask AI</TabsTrigger>
              <TabsTrigger value="table" disabled={!selectedTable}>
                {selectedTable ? `Table: ${selectedTable}` : "Table"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-6">
              <AIQueryPanel databaseUrl={connectionUrl} />
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              {schema && selectedTable ? (
                <TableDetail
                  schema={schema}
                  tableName={selectedTable}
                  databaseUrl={connectionUrl}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a table from the sidebar to view its structure.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="border-t md:hidden">
        <SchemaSidebar
          schema={schema}
          selectedTable={selectedTable}
          onSelect={handleSelectTable}
          onRefresh={handleRefreshSchema}
          loading={schemaLoading}
          error={schemaError}
        />
      </div>

      <ConnectionDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={handleSaved}
        onCleared={handleCleared}
      />
    </main>
  );
}

function Header({
  connectionUrl,
  onOpenSettings,
}: {
  connectionUrl: string | null;
  onOpenSettings: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b bg-background px-6 py-3">
      <div className="flex items-center gap-3">
        <Database className="size-5" />
        <div>
          <h1 className="text-base font-semibold leading-tight">AI Database Query</h1>
          <p className="text-xs text-muted-foreground">
            {connectionUrl ? `Connected · ${getHostLabel(connectionUrl)}` : "Not connected"}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSettings}
        aria-label="Connection settings"
      >
        <Settings className="size-4" />
      </Button>
    </header>
  );
}
