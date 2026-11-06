"use client";

import { addCuisineAction } from "@/app/actions/cuisines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cuisineKey, normalizeCuisineList, STANDARD_CUISINES } from "@/lib/domain/cuisines";
import { Check, Loader2, Plus, X } from "lucide-react";
import * as React from "react";

interface CatalogEntry {
  id: string;
  name: string;
  source: "standard" | "custom";
}

export function CuisinePicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = React.useState<CatalogEntry[]>(() =>
    STANDARD_CUISINES.map((name) => ({ id: `standard:${cuisineKey(name)}`, name, source: "standard" })),
  );
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    void fetch("/api/cuisines")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { cuisines?: CatalogEntry[] } | null) => {
        if (live && body?.cuisines) setCatalog(body.cuisines);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const selected = normalizeCuisineList(value, catalog.map((entry) => entry.name));
  const matching = catalog.filter((entry) => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const hasExactMatch = catalog.some((entry) => cuisineKey(entry.name) === cuisineKey(query));

  function toggle(name: string) {
    const exists = selected.some((cuisine) => cuisineKey(cuisine) === cuisineKey(name));
    onChange(exists ? selected.filter((cuisine) => cuisineKey(cuisine) !== cuisineKey(name)) : [...selected, name]);
  }

  async function addToCatalog() {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    const result = await addCuisineAction(name);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCatalog((current) =>
      current.some((entry) => cuisineKey(entry.name) === cuisineKey(result.entry.name))
        ? current
        : [...current, result.entry].sort((a, b) => a.name.localeCompare(b.name)),
    );
    onChange(normalizeCuisineList([...selected, result.entry.name], [...catalog.map((entry) => entry.name), result.entry.name]));
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line-strong bg-surface p-2.5">
        {selected.length ? (
          selected.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              disabled={disabled}
              onClick={() => toggle(cuisine)}
              className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2.5 py-1 text-xs font-medium text-clay-900 transition hover:bg-clay-200 disabled:cursor-not-allowed"
              title={`Remove ${cuisine}`}
            >
              {cuisine}
              <X className="size-3" />
            </button>
          ))
        ) : (
          <span className="px-1 py-1 text-sm text-ink-muted">Choose one or more cuisines</span>
        )}
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search cuisines, e.g. Greek"
        disabled={disabled || adding}
      />

      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {matching.map((entry) => {
          const active = selected.some((cuisine) => cuisineKey(cuisine) === cuisineKey(entry.name));
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(entry.name)}
              className={
                active
                  ? "inline-flex items-center gap-1 rounded-full border border-clay-500 bg-clay-50 px-2.5 py-1 text-xs font-medium text-clay-900"
                  : "rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-soft transition hover:border-line-strong hover:text-ink"
              }
            >
              {active ? <Check className="size-3" /> : null}
              {entry.name}
            </button>
          );
        })}
      </div>

      {query.trim() && !hasExactMatch ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted px-3 py-2">
          <span className="text-xs text-ink-muted">Not in your catalogue yet.</span>
          <Button type="button" variant="subtle" size="sm" onClick={addToCatalog} disabled={disabled || adding}>
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add “{query.trim()}” to catalogue
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-clay-800">{error}</p> : null}
      <p className="text-xs text-ink-muted">
        Select controlled labels. New labels are explicitly added to your catalogue, where custom ones can be renamed or removed.
      </p>
    </div>
  );
}
