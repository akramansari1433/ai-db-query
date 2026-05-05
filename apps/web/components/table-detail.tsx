"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Schema } from "@/lib/types";

interface TableDetailProps {
  schema: Schema;
  tableName: string;
  databaseUrl: string;
}

interface PreviewState {
  loading: boolean;
  error: string | null;
  rows: Record<string, unknown>[] | null;
  columns: string[];
}

const initialPreview: PreviewState = {
  loading: false,
  error: null,
  rows: null,
  columns: [],
};

export function TableDetail({ schema, tableName, databaseUrl }: TableDetailProps) {
  const [preview, setPreview] = useState<PreviewState>(initialPreview);

  const columns = schema.columns[tableName] ?? [];

  const outgoing = useMemo(
    () => schema.relationships.filter((r) => r.from.table === tableName),
    [schema.relationships, tableName]
  );
  const incoming = useMemo(
    () => schema.relationships.filter((r) => r.to.table === tableName),
    [schema.relationships, tableName]
  );

  const loadPreview = async () => {
    setPreview({ loading: true, error: null, rows: null, columns: [] });
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl, tableName, limit: 100 }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPreview({ loading: false, error: data.error ?? "Preview failed.", rows: null, columns: [] });
        return;
      }
      setPreview({
        loading: false,
        error: null,
        rows: data.rows ?? [],
        columns: data.columns ?? [],
      });
    } catch (e) {
      setPreview({
        loading: false,
        error: e instanceof Error ? e.message : "Network error.",
        rows: null,
        columns: [],
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-semibold">{tableName}</h2>
          <p className="text-sm text-muted-foreground">
            {columns.length} column{columns.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={loadPreview} disabled={preview.loading}>
          {preview.loading ? "Loading…" : "Preview 100 rows"}
        </Button>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Columns</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono">{c.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{c.type}</TableCell>
                  <TableCell>{c.nullable ? "yes" : "no"}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {c.default ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {(outgoing.length > 0 || incoming.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Foreign keys (out)</h3>
            {outgoing.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {outgoing.map((r) => (
                  <li key={r.constraint} className="font-mono">
                    {r.from.column} → {r.to.table}.{r.to.column}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Referenced by</h3>
            {incoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {incoming.map((r) => (
                  <li key={r.constraint} className="font-mono">
                    {r.from.table}.{r.from.column} → {r.to.column}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Preview</h3>
        {preview.error && <p className="text-sm text-red-600">{preview.error}</p>}
        {!preview.error && preview.rows === null && !preview.loading && (
          <p className="text-sm text-muted-foreground">
            Click <em>Preview 100 rows</em> to load data.
          </p>
        )}
        {preview.rows && preview.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No rows.</p>
        )}
        {preview.rows && preview.rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row, i) => (
                  <TableRow key={i}>
                    {preview.columns.map((c) => {
                      const v = row[c];
                      return (
                        <TableCell key={c} className="font-mono text-xs">
                          {v === null || v === undefined ? (
                            <span className="text-muted-foreground">NULL</span>
                          ) : typeof v === "object" ? (
                            JSON.stringify(v)
                          ) : (
                            String(v)
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
