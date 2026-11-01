"use client";
import * as React from "react";
import * as THREE from "three";
import { Minus, Plus, Download, Upload, Package, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SHOP, PATTERNS, COLOR, SIZES, BASES, type PatternId, type SizeId, type BaseId } from "./config";
import * as Dsg from "./design";
import { loadParts, renderThumbs, type SizeSources } from "./parts";
import { PoleScene } from "./Scene";
import { SwatchRow, ColorSelect } from "./ColorPickers";
import { saveFile } from "./files";
import { LfMark } from "./LfMark";
import { AdminPricing } from "./AdminPricing";

type Geos = Record<string, THREE.BufferGeometry>;
type Props = {
  parts: SizeSources;
  /** Admin only: builds the Bambu Studio project(s). Leave out on the public site. */
  exportProject?: (design: ReturnType<typeof Dsg.toDesign>, geos: Geos) => Promise<{ name: string; data: Uint8Array }>;
};

export function MossPoleConfigurator({ parts, exportProject }: Props) {
  const [state, setState] = React.useState(Dsg.initialState);
  const [cache, setCache] = React.useState<Partial<Record<SizeId, Geos>>>({});
  const geos = cache[state.size] ?? null;
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({});
  const [loadError, setLoadError] = React.useState(false);
  const [explode, setExplode] = React.useState(0);
  const [hl, setHl] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [loadOpen, setLoadOpen] = React.useState(false);
  const [jsonText, setJsonText] = React.useState("");
  const [loadMsg, setLoadMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const admin = !!exportProject;
  const [markup, setMarkup] = React.useState(SHOP.pricing.markup);
  const [discount, setDiscount] = React.useState<Dsg.Discount>({ kind: "percent", value: 0 });
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {          // load each size's parts the first time it is shown
    if (cache[state.size]) return;
    let live = true;
    loadParts(parts[state.size]).then(g => {
      if (!live) return;
      setCache(c => ({ ...c, [state.size]: g }));
      setThumbs(t => (Object.keys(t).length ? t : renderThumbs(g, Object.keys(PATTERNS))));
    }).catch(() => setLoadError(true));
    return () => { live = false; };
  }, [parts, state.size, cache]);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  const up = (f: (s: Dsg.State) => Dsg.State) => setState(s => f(s));
  const hover = (key: string) => (on: boolean) => setHl(on ? key : null);

  const n = state.sections.length;
  const poleIds = [...(state.base === "none" ? [state.baseColor] : []), ...state.sectionColors, ...(state.cup ? [state.cupColor] : [])];
  const poleOne = poleIds.every(c => c === poleIds[0]) ? poleIds[0] : null;
  const panOne = state.panels.every(p => p.color === state.panels[0].color) ? state.panels[0].color : null;
  const totals = Dsg.orderTotals(state, admin ? markup : undefined, admin ? discount : undefined);
  const lines = totals.lines, total = totals.total;
  const pos = (i: number, len: number) => (i === len - 1 ? "Top" : i === 0 ? "Bottom" : `Level ${i + 1}`);

  async function onSave() {
    const r = await saveFile(`moss-pole-${Dsg.heightCm(state)}cm.json`, JSON.stringify(Dsg.toDesign(state), null, 2));
    if (r === "saved") say("Design saved");
    if (r === "fallback") { setJsonText(JSON.stringify(Dsg.toDesign(state), null, 2)); setLoadMsg("Copy this and keep it. Paste it into Load design to open it again."); setLoadOpen(true); }
  }
  function applyText(text: string) {
    try { setState(Dsg.fromDesign(JSON.parse(text))); setLoadOpen(false); say("Design loaded"); }
    catch (e: any) { setLoadMsg(e instanceof SyntaxError ? "That isn’t valid JSON. Paste the whole design file." : e.message); setLoadOpen(true); }
  }
  async function onExport() {
    if (!exportProject) return;
    setBusy(true);
    if (!geos) return;
    try { const f = await exportProject(Dsg.toDesign(state), geos); const r = await saveFile(f.name, f.data); if (r !== "declined") say("Bambu project exported"); }
    catch (e: any) { say(e.message || "Export failed"); }
    finally { setBusy(false); }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid h-full grid-cols-1 bg-background text-foreground md:grid-cols-[minmax(0,1fr)_420px]">
        {/* ------------------------------------------------------------ stage */}
        <div className="relative h-[56vh] overflow-hidden bg-stage md:h-full">
          <PoleScene geos={geos} state={state} explode={explode} highlight={hl} />
          <div className="pointer-events-none absolute left-6 top-5 flex items-center gap-3">
            <LfMark className="w-8 fill-foreground" /><span className="text-sm font-bold">Layer Forge Labs</span>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-6" aria-live="polite">
            <div className="text-[56px] font-extrabold leading-[0.9] tracking-tighter tabular-nums md:text-[clamp(56px,9vw,104px)]">{Dsg.heightCm(state)} cm</div>
            <div className="mt-2 text-sm text-muted-foreground">{SIZES[state.size].name}, {Dsg.heightNote(state)} · {n} section{n === 1 ? "" : "s"}, {state.panels.length} panels</div>
          </div>
          {!geos && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{loadError ? "The 3D preview couldn’t load in this browser. You can still build your design." : "Loading parts…"}</div>}
          <div className="pointer-events-none absolute bottom-4 right-4 hidden text-xs text-muted-foreground sm:block">Drag to rotate, scroll to zoom</div>
        </div>

        {/* ------------------------------------------------------------ panel */}
        <aside className="flex min-h-0 flex-col border-l bg-card max-md:border-l-0 max-md:border-t md:overflow-y-auto">
          <div className="px-7 pb-2 pt-7">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">Build your moss pole</h1>
            <p className="mt-2 max-w-[34ch] text-muted-foreground">Stack sections to the height your plant needs, then pick a panel design for each level.</p>
          </div>

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold">Size</h2>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Width and depth of the pole. Sections are 10 or 20 cm tall in every size.</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pole size">
              {(Object.keys(SIZES) as SizeId[]).map(k => (
                <button key={k} role="radio" aria-checked={state.size === k} onClick={() => up(s => ({ ...s, size: k }))}
                  className={cn("rounded-lg border-2 bg-background px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state.size === k ? "border-primary" : "border-transparent hover:border-border")}>
                  <span className="block font-semibold">{SIZES[k].name}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">{(SIZES[k].W / 10).toFixed(1)} × {(SIZES[k].D / 10).toFixed(1)} cm</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{SIZES[state.size].note}</p>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold">Base</h2>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">How the pole stands.</p>
            <div className="grid gap-2" role="radiogroup" aria-label="Base">
              {(Object.keys(BASES) as BaseId[]).map(k => (
                <button key={k} role="radio" aria-checked={state.base === k} onClick={() => up(s => Dsg.setBase(s, k))}
                  className={cn("rounded-lg border-2 bg-background px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state.base === k ? "border-primary" : "border-transparent hover:border-border")}>
                  <span className="block font-semibold">{BASES[k].name}{k === "pot" && <span className="ml-2 font-normal text-muted-foreground tabular-nums">Ø{SIZES[state.size].pot[0] / 10} cm</span>}</span>
                  <span className="block text-sm text-muted-foreground">{BASES[k].note}</span>
                </button>
              ))}
            </div>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold">Sections</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Add sections underneath the top one; you can add more later as the plant grows.</p>
            <ul className="space-y-1.5">
              {state.cup && <Row muted><span className="flex-1 font-medium">Water cup</span><span className="text-sm text-muted-foreground">inside the top section</span></Row>}
              {[...state.sections.keys()].reverse().map(i => {
                const top = i === n - 1;
                return (
                  <Row key={i} onPointerEnter={() => setHl("sec" + i)} onPointerLeave={() => setHl(null)}>
                    <span className="flex-1 font-medium">Section {i + 1}</span>
                    {top ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="size-3.5" />10 cm, top</span>
                    ) : (
                      <div className="inline-flex rounded-md border p-0.5" role="group" aria-label={`Section ${i + 1} height`}>
                        {([100, 200] as const).map(h => (
                          <button key={h} aria-pressed={state.sections[i] === h} onClick={() => up(s => Dsg.setSectionSize(s, i, h))}
                            className={cn("h-7 rounded px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              state.sections[i] === h ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent")}>{h / 10} cm</button>
                        ))}
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={top}
                      aria-label={`Remove section ${i + 1}`} onClick={() => up(s => Dsg.removeSection(s, i))}><Minus /></Button>
                  </Row>
                );
              })}
              <Row muted><span className="flex-1 font-medium">{state.base === "pot" ? "Pot" : state.base === "spike" ? "Spike" : "Base"}</span>
                <span className="text-sm text-muted-foreground">{state.base === "pot" ? `Ø${SIZES[state.size].pot[0] / 10} cm, with saucer` : state.base === "spike" ? "pushes into the soil" : "20 cm, goes in the pot"}</span></Row>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {([100, 200] as const).map(h => (
                <Button key={h} variant="outline" disabled={n >= SHOP.maxSections} onClick={() => up(s => Dsg.addSection(s, h))}><Plus />Add {h / 10} cm section</Button>
              ))}
            </div>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold">Panels</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Panels slide down the back and overlap the joints. Choose a design for each one, top to bottom.</p>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Set all to</span>
              {(Object.keys(PATTERNS) as PatternId[]).map(k => (
                <Button key={k} variant="outline" size="sm" className="rounded-full"
                  onClick={() => up(s => ({ ...s, panels: s.panels.map(p => ({ ...p, pat: k })) }))}>{PATTERNS[k]}</Button>
              ))}
            </div>
            <div className="space-y-3">
              {[...state.panels.keys()].reverse().map(i => {
                const p = state.panels[i];
                return (
                  <div key={i} className="grid grid-cols-[72px_1fr] items-center gap-3" onPointerEnter={() => setHl("pan" + i)} onPointerLeave={() => setHl(null)}>
                    <div className="text-sm text-muted-foreground"><b className="block font-semibold text-foreground">{pos(i, state.panels.length)}</b>{p.size / 10} cm</div>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${pos(i, state.panels.length)} panel design`}>
                      {(Object.keys(PATTERNS) as PatternId[]).map(k => (
                        <button key={k} role="radio" aria-checked={p.pat === k}
                          onClick={() => up(s => ({ ...s, panels: s.panels.map((x, j) => (j === i ? { ...x, pat: k } : x)) }))}
                          className={cn("grid justify-items-center gap-1 rounded-lg border-2 bg-background p-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            p.pat === k ? "border-primary" : "border-transparent hover:border-border")}>
                          {thumbs[k] ? <img src={thumbs[k]} alt="" className="aspect-[91/100] w-full max-w-16 object-contain" /> : <span className="aspect-[91/100] w-full max-w-16" />}
                          {PATTERNS[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold"><Label htmlFor="cup" className="text-lg font-bold">Water cup</Label></h2>
                <p className="mt-1 text-sm text-muted-foreground">Sits inside the top section. Turn the knob on its lid to set how fast it drips into the moss.</p>
              </div>
              <Switch id="cup" checked={state.cup} onCheckedChange={v => up(s => ({ ...s, cup: v }))} />
            </div>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold">Colors</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">All colors have a matte finish, except Translucent olive, which lets light through{state.base !== "none" ? " (not available for the pot, saucer or spike)" : ""}.</p>
            <div className="space-y-5">
              <SwatchRow label="Pole" value={poleOne}
                onChange={id => up(s => ({ ...s, baseColor: s.base === "none" ? id : s.baseColor, cupColor: id, sectionColors: s.sectionColors.map(() => id) }))} />
              <SwatchRow label="Panels" value={panOne}
                onChange={id => up(s => ({ ...s, panels: s.panels.map(p => ({ ...p, color: id })) }))} />
              {state.base !== "none" && <SwatchRow label={state.base === "pot" ? "Pot" : "Spike"} value={state.baseColor} matteOnly
                onChange={id => up(s => ({ ...s, baseColor: id }))} onHover={hover("base")} />}
              {state.base === "pot" && <SwatchRow label="Saucer" value={state.saucerColor} matteOnly
                onChange={id => up(s => ({ ...s, saucerColor: id }))} onHover={hover("saucer")} />}
            </div>
            <Accordion type="single" collapsible className="mt-4 border-t">
              <AccordionItem value="parts" className="border-b-0">
                <AccordionTrigger className="text-[15px] font-semibold">Choose a color for each part</AccordionTrigger>
                <AccordionContent>
                  <PartList title="Pole, top to bottom">
                    {state.cup && <PartRow label="Valve knob" onHover={hover("knob")}><ColorSelect label="Valve knob" value={state.knobColor} onChange={id => up(s => ({ ...s, knobColor: id }))} /></PartRow>}
                    {state.cup && <PartRow label="Water cup" sub="with lid and valve stem" onHover={hover("cup")}><ColorSelect label="Water cup" value={state.cupColor} onChange={id => up(s => ({ ...s, cupColor: id }))} /></PartRow>}
                    {[...state.sections.keys()].reverse().map(i => (
                      <PartRow key={i} label={`Section ${i + 1}`} sub={`${state.sections[i] / 10} cm`} onHover={hover("sec" + i)}>
                        <ColorSelect label={`Section ${i + 1}`} value={state.sectionColors[i]}
                          onChange={id => up(s => ({ ...s, sectionColors: s.sectionColors.map((c, j) => (j === i ? id : c)) }))} />
                      </PartRow>
                    ))}
                    {state.base === "none" && <PartRow label="Base" sub="20 cm" onHover={hover("base")}><ColorSelect label="Base" value={state.baseColor} onChange={id => up(s => ({ ...s, baseColor: id }))} /></PartRow>}
                  </PartList>
                  {state.base !== "none" && (
                    <PartList title={state.base === "pot" ? "Pot and saucer (matte colors)" : "Spike (matte colors)"}>
                      <PartRow label={state.base === "pot" ? "Pot" : "Spike"} sub={SIZES[state.size].name} onHover={hover("base")}>
                        <ColorSelect matteOnly label={state.base === "pot" ? "Pot" : "Spike"} value={state.baseColor} onChange={id => up(s => ({ ...s, baseColor: id }))} /></PartRow>
                      {state.base === "pot" && <PartRow label="Saucer" onHover={hover("saucer")}>
                        <ColorSelect matteOnly label="Saucer" value={state.saucerColor} onChange={id => up(s => ({ ...s, saucerColor: id }))} /></PartRow>}
                    </PartList>
                  )}
                  <PartList title="Panels, top to bottom">
                    {[...state.panels.keys()].reverse().map(i => (
                      <PartRow key={i} label={`${pos(i, state.panels.length)} panel`} sub={`${state.panels[i].size / 10} cm, ${PATTERNS[state.panels[i].pat]}`} onHover={hover("pan" + i)}>
                        <ColorSelect label={`${pos(i, state.panels.length)} panel`} value={state.panels[i].color}
                          onChange={id => up(s => ({ ...s, panels: s.panels.map((p, j) => (j === i ? { ...p, color: id } : p)) }))} />
                      </PartRow>
                    ))}
                  </PartList>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
          <Separator />

          <section className="px-7 py-5">
            <h2 className="text-lg font-bold"><Label htmlFor="explode" className="text-lg font-bold">See the parts</Label></h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Pull the pole apart to see how it fits together.</p>
            <Slider id="explode" min={0} max={1} step={0.01} value={[explode]} onValueChange={v => setExplode(v[0])} aria-label="Separate the parts" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Assembled</span><span>Separated</span></div>
          </section>

          {admin && <AdminPricing state={state} markup={markup} setMarkup={setMarkup} discount={discount} setDiscount={setDiscount} />}
          {/* ---------------------------------------------------------- order */}
          <div className="sticky bottom-0 mt-auto border-t bg-card px-7 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="lines" className="border-b-0">
                <AccordionTrigger className="py-1.5 text-sm font-normal text-muted-foreground">Price breakdown ({lines.reduce((n, l) => n + l.qty, 0)} items)</AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ul className="max-h-40 space-y-0.5 overflow-auto text-sm text-muted-foreground">
                    {lines.map(l => <li key={l.label + l.each} className="flex justify-between gap-3 tabular-nums"><span>{l.qty} × {l.label}</span><span>{Dsg.fmt(l.qty * l.each)}</span></li>)}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {totals.discount > 0 && <div className="mb-1 flex justify-between text-sm tabular-nums"><span>Discount</span><span>−{Dsg.fmt(totals.discount)}</span></div>}
            <div className="mb-3 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">{admin ? "Customer pays" : "Estimated price"}</span><span className="text-right">
              {totals.discount > 0 && <span className="mr-2 text-sm text-muted-foreground line-through tabular-nums">{Dsg.fmt(totals.subtotal)}</span>}
              <span className="text-3xl font-extrabold tracking-tight tabular-nums">{Dsg.fmt(total)}</span></span></div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onSave}><Download />Save design</Button>
              <Button variant="outline" onClick={() => { setJsonText(""); setLoadMsg("Choose a saved design file, or paste its text here."); setLoadOpen(true); }}><Upload />Load design</Button>
              {exportProject && (
                <Button className="col-span-2" variant="secondary" disabled={busy} onClick={onExport}><Package />{busy ? "Building project…" : "Export Bambu Studio project"}</Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{SHOP.note}</p>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) applyText(await f.text()); }} />
          </div>
        </aside>
      </div>

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{jsonText && !loadMsg.startsWith("Choose") && loadMsg.startsWith("Copy") ? "Your design" : "Load a design"}</DialogTitle>
            <DialogDescription>{loadMsg}</DialogDescription></DialogHeader>
          <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} spellCheck={false}
            className="h-60 w-full rounded-md border bg-background p-3 font-[inherit] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <DialogFooter>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>Choose a file</Button>
            <Button onClick={() => (loadMsg.startsWith("Copy") ? setLoadOpen(false) : applyText(jsonText))}>{loadMsg.startsWith("Copy") ? "Done" : "Load design"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div role="status" className={cn("pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background transition-opacity", toast ? "opacity-100" : "opacity-0")}>{toast}</div>
    </TooltipProvider>
  );
}

function Row({ children, muted, ...rest }: React.HTMLAttributes<HTMLLIElement> & { muted?: boolean }) {
  return <li className={cn("flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-1.5", muted ? "border-dashed" : "bg-background")} {...rest}>{children}</li>;
}
function PartList({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-4 last:mb-0"><div className="mb-1.5 text-xs text-muted-foreground">{title}</div><div className="divide-y">{children}</div></div>;
}
function PartRow({ label, sub, onHover, children }: { label: string; sub?: string; onHover: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}>
      <div className="min-w-0"><div className="truncate text-sm font-semibold">{label}</div>{sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}</div>
      {children}
    </div>
  );
}
