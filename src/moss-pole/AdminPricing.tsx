"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SHOP } from "./config";
import * as Dsg from "./design";

// Admin only: markup, per-order discount, and cost / price / profit per line.
export function AdminPricing({ state, markup, setMarkup, discount, setDiscount }: {
  state: Dsg.State; markup: number; setMarkup: (m: number) => void; discount: Dsg.Discount; setDiscount: (d: Dsg.Discount) => void;
}) {
  const t = Dsg.orderTotals(state, markup, discount);
  const f = Dsg.fmt;
  return (
    <section className="border-y border-dashed border-primary/40 bg-primary/5 px-7 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Pricing</h2>
        <span className="text-xs text-muted-foreground">Only on your admin page</span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="markup">Markup</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">×</span>
            <Input id="markup" type="number" min={1} max={6} step={0.1} value={markup}
              onChange={e => setMarkup(Math.max(1, Math.min(6, +e.target.value || 1)))} className="h-8 w-20 text-right tabular-nums" />
          </div>
        </div>
        <Slider min={1} max={4} step={0.1} value={[Math.min(4, markup)]} onValueChange={v => setMarkup(+v[0].toFixed(1))} aria-label="Markup" />
        <div className="flex justify-between text-xs text-muted-foreground"><span>×1 (at cost)</span><span>Default ×{SHOP.pricing.markup}</span><span>×4</span></div>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="discount">Discount for this order</Label>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Discount type">
            {(["percent", "amount"] as const).map(k => (
              <button key={k} aria-pressed={discount.kind === k} onClick={() => setDiscount({ kind: k, value: 0 })}
                className={cn("h-7 rounded px-2.5 text-sm", discount.kind === k ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent")}>
                {k === "percent" ? "%" : "$"}
              </button>))}
          </div>
          <Input id="discount" type="number" min={0} step={discount.kind === "percent" ? 1 : 0.5} value={discount.value}
            onChange={e => setDiscount({ ...discount, value: Math.max(0, +e.target.value || 0) })} className="h-8 w-24 text-right tabular-nums" />
          {discount.kind === "percent" && [10, 15, 20].map(v => (
            <Button key={v} variant="outline" size="sm" className="h-8 px-2" onClick={() => setDiscount({ kind: "percent", value: v })}>{v}%</Button>))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="pb-1 text-left font-normal">Item</th><th className="pb-1 text-right font-normal">Cost</th><th className="pb-1 text-right font-normal">Price</th><th className="pb-1 text-right font-normal">Profit</th></tr>
          </thead>
          <tbody>
            {t.lines.map(l => (
              <tr key={l.label + l.each} className="border-t">
                <td className="py-1 pr-2">{l.qty > 1 ? `${l.qty} × ` : ""}{l.label}</td>
                <td className="py-1 text-right text-muted-foreground">{f(l.qty * l.cost)}</td>
                <td className="py-1 text-right">{f(l.qty * l.each)}</td>
                <td className="py-1 text-right">{f(l.qty * (l.each - l.cost))}</td>
              </tr>))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
        <dt className="text-muted-foreground">Your cost</dt><dd className="text-right">{f(t.cost)}</dd>
        <dt className="text-muted-foreground">Price before discount</dt><dd className="text-right">{f(t.subtotal)}</dd>
        <dt className="text-muted-foreground">Discount</dt><dd className="text-right">{t.discount ? `−${f(t.discount)}` : f(0)}</dd>
        <dt className="font-semibold">Customer pays</dt><dd className="text-right font-semibold">{f(t.total)}</dd>
        <dt className="font-semibold">Profit</dt>
        <dd className={cn("text-right text-base font-bold", t.profit < 0 && "text-destructive")}>{f(t.profit)} <span className="text-xs font-normal text-muted-foreground">({Math.round(t.margin * 100)}% of price)</span></dd>
      </dl>
      {t.profit < 0 && <p className="mt-2 text-sm text-destructive">This discount puts the order below your cost.</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Cost = filament (${SHOP.pricing.materialPerKg.matte}/kg matte, ${SHOP.pricing.materialPerKg.translucent}/kg translucent, +{Math.round((SHOP.pricing.wasteFactor - 1) * 100)}% waste) + printer time at ${SHOP.pricing.machinePerHour}/h, plus ${SHOP.pricing.packingCost} packing. Change these in config.ts.
      </p>
    </section>
  );
}
