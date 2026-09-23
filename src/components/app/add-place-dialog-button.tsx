"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddPlaceDialog } from "./add-place-dialog";
import type { ProviderInfo } from "@/lib/places";

/**
 * Wrapper used in empty states: the dialog owns its own trigger button, so we
 * simply render it here with a neutral provider descriptor.
 */
export function AddPlaceDialogButton({
  label = "Add your first place",
  provider = { id: "osm", label: "OpenStreetMap Cyprus", mode: "local", configured: true },
}: {
  label?: string;
  provider?: ProviderInfo;
}) {
  return (
    <AddPlaceDialog
      provider={provider}
      trigger={
        <Button>
          <Plus className="size-4" />
          {label}
        </Button>
      }
    />
  );
}
