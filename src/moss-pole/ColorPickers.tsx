"use client";
import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SHOP, COLOR } from "./config";

const Dot = ({ id, className }: { id: string; className?: string }) => {
  const c = COLOR[id];
  return <span aria-hidden className={cn("inline-block shrink-0 rounded-full border border-border", c.finish === "translucent" && "swatch-glass", className)}
               style={{ backgroundColor: c.hex }} />;
};

// One row of swatches. Label sits above, so all colors fit on one line.
export function SwatchRow({ label, value, onChange, onHover, matteOnly }:
  { label: string; value: string | null; onChange: (id: string) => void; onHover?: (on: boolean) => void; matteOnly?: boolean }) {
  const list = SHOP.colors.filter(c => !matteOnly || c.finish === "matte");
  return (
    <div className="space-y-2" onPointerEnter={() => onHover?.(true)} onPointerLeave={() => onHover?.(false)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">{value ? COLOR[value].name : "Mixed colors"}</span>
      </div>
      <div role="radiogroup" aria-label={`${label} color`} className="flex gap-2">
        {list.map(c => (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <button role="radio" aria-checked={value === c.id} aria-label={c.name} onClick={() => onChange(c.id)}
                className={cn("size-8 rounded-full ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  value === c.id && "ring-2 ring-primary ring-offset-2")}>
                <Dot id={c.id} className="size-8" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{c.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// Compact dropdown with a swatch, for the per-part list.
export function ColorSelect({ value, onChange, label, matteOnly }: { value: string; onChange: (id: string) => void; label: string; matteOnly?: boolean }) {
  const list = SHOP.colors.filter(c => !matteOnly || c.finish === "matte");
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[11.5rem]" aria-label={`${label} color`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {list.map(c => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2"><Dot id={c.id} className="size-4" />{c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
