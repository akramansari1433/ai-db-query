"use client";

import { RefreshCw, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Schema } from "@/lib/types";

interface SchemaSidebarProps {
  schema: Schema | null;
  selectedTable: string | null;
  onSelect: (tableName: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
}

export function SchemaSidebar({
  schema,
  selectedTable,
  onSelect,
  onRefresh,
  loading,
  error,
}: SchemaSidebarProps) {
  const tableCount = schema?.tables.length ?? 0;

  return (
    <aside className="flex h-full w-full flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Tables</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${tableCount} table${tableCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh schema"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {error && (
          <p className="px-2 py-3 text-sm text-red-600">{error}</p>
        )}
        {!error && !loading && tableCount === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No tables found in schema <code>public</code>.
          </p>
        )}
        <ul className="space-y-1">
          {schema?.tables.map((table) => {
            const cols = schema.columns[table] ?? [];
            const isSelected = selectedTable === table;
            return (
              <li key={table}>
                <button
                  type="button"
                  onClick={() => onSelect(table)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Table2 className="size-3.5 shrink-0" />
                    <span className="truncate font-mono">{table}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {cols.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
