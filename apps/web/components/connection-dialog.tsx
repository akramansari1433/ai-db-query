"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  clearConnectionUrl,
  getConnectionUrl,
  setConnectionUrl,
} from "@/lib/connection";
import { validatePgUrl } from "@/lib/validate-pg-url";

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (url: string) => void;
  onCleared: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success"; tableCount: number }
  | { kind: "error"; message: string };

export function ConnectionDialog({
  open,
  onOpenChange,
  onSaved,
  onCleared,
}: ConnectionDialogProps) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    if (open) {
      setValue(getConnectionUrl() ?? "");
      setError(null);
      setTestState({ kind: "idle" });
      setReveal(false);
    }
  }, [open]);

  const handleSave = () => {
    const result = setConnectionUrl(value);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onSaved(value);
    onOpenChange(false);
  };

  const handleClear = () => {
    clearConnectionUrl();
    setValue("");
    setTestState({ kind: "idle" });
    onCleared();
    onOpenChange(false);
  };

  const handleTest = async () => {
    const validation = validatePgUrl(value);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setError(null);
    setTestState({ kind: "testing" });
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: value }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestState({ kind: "success", tableCount: data.tableCount ?? 0 });
      } else {
        setTestState({ kind: "error", message: data.error ?? "Unknown error" });
      }
    } catch (e) {
      setTestState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Database connection</DialogTitle>
          <DialogDescription>
            Connect a PostgreSQL database. The connection URL stays in your
            browser and is sent only with each query.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <strong>Use a read-only role.</strong> Never paste a connection
            string with admin or superuser privileges. Queries are restricted
            to <code>SELECT</code> only, but defense in depth matters.
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="connection-url" className="text-sm font-medium">
            Connection URL
          </label>
          <div className="relative">
            <Input
              id="connection-url"
              type={reveal ? "text" : "password"}
              placeholder="postgres://user:pass@host:5432/dbname"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setTestState({ kind: "idle" });
              }}
              autoComplete="off"
              spellCheck={false}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={reveal ? "Hide URL" : "Show URL"}
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {testState.kind === "testing" && (
            <p className="text-sm text-muted-foreground">Testing connection…</p>
          )}
          {testState.kind === "success" && (
            <p className="text-sm text-green-700">
              Connected. Found {testState.tableCount} table
              {testState.tableCount === 1 ? "" : "s"}.
            </p>
          )}
          {testState.kind === "error" && (
            <p className="text-sm text-red-600">
              Connection failed: {testState.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClear} type="button">
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testState.kind === "testing" || !value}
            type="button"
          >
            Test
          </Button>
          <Button onClick={handleSave} disabled={!value} type="button">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
