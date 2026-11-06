"use client";

import { addCuisineAction, removeCuisineAction, renameCuisineAction } from "@/app/actions/cuisines";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";

export function CuisineCatalogManager({ initial }: { initial: { id: string; name: string }[] }) {
  const [entries, setEntries] = React.useState(initial);
  const [newName, setNewName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  async function add() {
    setPending("new");
    setError(null);
    const result = await addCuisineAction(newName);
    setPending(null);
    if (!result.ok) return setError(result.error);
    if (result.entry.source === "custom") {
      setEntries((current) =>
        current.some((entry) => entry.id === result.entry.id)
          ? current
          : [...current, { id: result.entry.id, name: result.entry.name }].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    setNewName("");
  }

  async function rename(id: string, currentName: string) {
    const name = window.prompt("Rename cuisine", currentName)?.trim();
    if (!name || name === currentName) return;
    setPending(id);
    setError(null);
    const result = await renameCuisineAction(id, name);
    setPending(null);
    if (!result.ok) return setError(result.error);
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, name } : entry)).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function remove(id: string) {
    setPending(id);
    setError(null);
    const result = await removeCuisineAction(id);
    setPending(null);
    if (!result.ok) return setError(result.error);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        The built-in cuisine set is shared and stable. Add a custom label here only when it is genuinely useful; rename updates every saved place that uses it, and removal is blocked while it is in use.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Ethiopian" maxLength={50} />
        <Button type="button" variant="outline" onClick={add} disabled={!newName.trim() || pending !== null}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {entries.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="font-medium">{entry.name}</span>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Rename ${entry.name}`} onClick={() => rename(entry.id, entry.name)} disabled={pending !== null}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${entry.name}`} onClick={() => remove(entry.id)} disabled={pending !== null}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No custom cuisine labels yet.</p>
      )}
    </div>
  );
}
