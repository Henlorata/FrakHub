import {useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode} from "react";
import {toast} from "sonner";
import {AlertTriangle, Eraser, ImageUp, Loader2, PenLine, RotateCcw, Save, Shuffle, Sparkles, Type, Undo2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Slider} from "@/components/ui/slider";
import {Switch} from "@/components/ui/switch";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {useAuth} from "@/context/AuthContext";
import {decodePicture, strokesToSignature, tracePicture, type DecodedPicture} from "@/lib/signature/capture";
import {smoothClosedPath, type SignatureData} from "@/lib/signature/geometry";
import {strokeOutline, type InkPoint} from "@/lib/signature/ink";
import {loadAllStyles, nameVariants, randomAutoSignature, renderStyledSignature, SIGNATURE_STYLES, type Flourish, type SignatureStyle} from "@/lib/signature/styles";
import {signatureApi, type SignatureMethod} from "@/lib/signature/api";
import {cn, errorMessage} from "@/lib/utils";
import {SIGNATURE_INK, SignatureMark} from "./SignatureMark";

type Tab = "draw" | "upload" | "style" | "auto";

/**
 * Setting the member's signature: drawn on a pad, traced from a picture (only the ink is kept, the
 * picture never leaves the browser), one of the handwriting styles of their name, or a generated
 * one. Every method ends in the same vector outline, stored once in the profile.
 */
export default function SignatureDialog({open, onOpenChange, onSaved}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const {profile} = useAuth();
  const [tab, setTab] = useState<Tab>("draw");
  const [result, setResult] = useState<{signature: SignatureData; method: SignatureMethod; style: string | null} | null>(null);
  const [saving, setSaving] = useState(false);

  const name = profile?.full_name ?? "";
  const save = async () => {
    if (!profile || !result) return;
    setSaving(true);
    try {
      await signatureApi.save(profile.id, result.signature, result.method, result.style);
      toast.success("Aláírás mentve. Mostantól ez kerül a nyomtatható iratokra.");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Az aláírás mentése nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const changeTab = (value: string) => {
    setTab(value as Tab);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="size-5 text-amber-300"/> Aláírás</DialogTitle>
          <DialogDescription>A nyomtatható iratokon (szolgálati lap, akták, parancsok, oklevelek) ez kerül a neved fölé.</DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="draw"><PenLine className="size-4"/> Rajzolás</TabsTrigger>
              <TabsTrigger value="upload"><ImageUp className="size-4"/> Képről</TabsTrigger>
              <TabsTrigger value="style"><Type className="size-4"/> Stílusok</TabsTrigger>
              <TabsTrigger value="auto"><Sparkles className="size-4"/> Automatikus</TabsTrigger>
            </TabsList>
            <TabsContent value="draw" className="mt-4">
              <DrawPanel onChange={(signature) => setResult(signature ? {signature, method: "draw", style: null} : null)}/>
            </TabsContent>
            <TabsContent value="upload" className="mt-4">
              <UploadPanel onChange={(signature) => setResult(signature ? {signature, method: "upload", style: null} : null)}/>
            </TabsContent>
            <TabsContent value="style" className="mt-4">
              <StylePanel name={name} onChange={(signature, style) => setResult(signature ? {signature, method: "style", style} : null)}/>
            </TabsContent>
            <TabsContent value="auto" className="mt-4">
              <AutoPanel name={name} onChange={(signature, style) => setResult(signature ? {signature, method: "auto", style} : null)}/>
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={!result || saving}>
            {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The paper the previews sit on: a baseline and the name under it, as on the documents. */
function Paper({children, caption, className, style}: {children: ReactNode; caption?: string; className?: string; style?: CSSProperties}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-[#fbf8f1] ring-1 ring-black/10", className)} style={style}>
      <div aria-hidden className="pointer-events-none absolute inset-x-[8%] bottom-[26%] border-t border-dashed border-[#b8b2a7]"/>
      <span aria-hidden className="pointer-events-none absolute bottom-[27%] left-[5%] text-lg text-[#b8b2a7]">×</span>
      {caption && <p className="pointer-events-none absolute inset-x-0 bottom-[8%] text-center text-[11px] text-[#78716c]">{caption}</p>}
      {children}
    </div>
  );
}

function Preview({signature, caption}: {signature: SignatureData | null; caption?: string}) {
  return (
    <Paper caption={caption} className="aspect-[3/1] w-full">
      <div className="absolute inset-x-[10%] top-[10%] bottom-[30%] flex items-end justify-center">
        {signature ? <SignatureMark signature={signature} draw className="h-full max-w-full" style={{color: SIGNATURE_INK}}/> : null}
      </div>
    </Paper>
  );
}

// --- Drawing ---------------------------------------------------------------------------------

const PEN_SIZE = 5.5;

function DrawPanel({onChange}: {onChange: (signature: SignatureData | null) => void}) {
  const {profile} = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<InkPoint[][]>([]);
  const [drawing, setDrawing] = useState(false);
  const active = useRef<InkPoint[] | null>(null);
  const finished = useRef<Path2D[]>([]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const ratio = canvas.width / canvas.clientWidth;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = SIGNATURE_INK;
    for (const path of finished.current) ctx.fill(path);
    if (active.current?.length) ctx.fill(new Path2D(smoothClosedPath(strokeOutline(active.current, {size: PEN_SIZE}), (p) => p)));
  }, []);

  // Sharp on high-density screens; repaint after a resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      paint();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const point = (event: PointerEvent | ReactPointerEvent): InkPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pen = event.pointerType === "pen" && event.pressure > 0;
    return {x: event.clientX - rect.left, y: event.clientY - rect.top, pressure: pen ? event.pressure : null, t: event.timeStamp};
  };

  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = [point(event)];
    setDrawing(true);
    paint();
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!active.current) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const item of events) active.current.push(point(item));
    paint();
  };
  const up = () => {
    if (!active.current) return;
    const stroke = active.current;
    active.current = null;
    setDrawing(false);
    finished.current.push(new Path2D(smoothClosedPath(strokeOutline(stroke, {size: PEN_SIZE}), (p) => p)));
    setStrokes((current) => [...current, stroke]);
  };

  useEffect(() => {
    onChange(strokes.length ? strokesToSignature(strokes, PEN_SIZE) : null);
    // onChange is a fresh closure from the parent; only the strokes matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  const undo = () => {
    finished.current.pop();
    setStrokes((current) => current.slice(0, -1));
    requestAnimationFrame(paint);
  };
  const clear = () => {
    finished.current = [];
    setStrokes([]);
    requestAnimationFrame(paint);
  };

  return (
    <div className="space-y-3">
      <Paper caption={profile?.full_name} className="aspect-[3/1] w-full touch-none select-none">
        <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-crosshair touch-none" aria-label="Rajzolj ide"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}/>
        {strokes.length === 0 && !drawing && (
          <p className="pointer-events-none absolute inset-x-0 top-[34%] text-center text-sm text-[#a8a29e]">Írd alá itt egérrel, ujjal vagy tollal</p>
        )}
      </Paper>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={undo} disabled={!strokes.length}><Undo2/> Visszavonás</Button>
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!strokes.length}><Eraser/> Törlés</Button>
        <p className="ml-auto text-[11px] text-slate-500">Tollal a nyomás erőssége is számít.</p>
      </div>
    </div>
  );
}

// --- Picture -----------------------------------------------------------------------------------

function UploadPanel({onChange}: {onChange: (signature: SignatureData | null) => void}) {
  const [picture, setPicture] = useState<DecodedPicture | null>(null);
  const [sensitivity, setSensitivity] = useState(0.16);
  const [invert, setInvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [traced, setTraced] = useState<{signature: SignatureData | null; inkShare: number} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Képfájlt válassz (JPG, PNG, WEBP).");
    if (file.size > 15 * 1024 * 1024) return toast.error("A kép legfeljebb 15 MB lehet.");
    setBusy(true);
    try {
      const decoded = await decodePicture(file);
      setInvert(decoded.darkBackground);
      setPicture(decoded);
    } catch {
      toast.error("A kép nem olvasható be.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!picture) return;
    // Let the slider move freely; trace once it stops.
    const timer = window.setTimeout(() => {
      const next = tracePicture(picture, sensitivity, invert);
      setTraced(next);
      onChange(next.signature);
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture, sensitivity, invert]);

  const tooMuch = traced && traced.inkShare > 0.38;
  return (
    <div className="space-y-3">
      {picture ? <Preview signature={traced?.signature ?? null}/> : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void pick(event.dataTransfer.files[0]);
                }}
                className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] text-sm text-slate-300 transition hover:border-amber-400/50 hover:bg-white/[0.04]">
          {busy ? <Loader2 className="size-6 animate-spin"/> : <ImageUp className="size-7 text-amber-300"/>}
          <span>Kép az aláírásodról: kattints vagy húzd ide</span>
          <span className="text-[11px] text-slate-500">Fehér papíron, sötét tollal, jó fényben a legszebb.</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void pick(event.target.files?.[0])}/>
      {picture && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Érzékenység: halványabb vonalak is ({Math.round(sensitivity * 100)}%)</Label>
            <Slider value={[sensitivity]} min={0.05} max={0.4} step={0.01} onValueChange={([value]) => setSensitivity(value)}/>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300"><Switch checked={invert} onCheckedChange={setInvert}/> Sötét háttér</label>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}><RotateCcw/> Másik kép</Button>
          </div>
        </div>
      )}
      {tooMuch && (
        <p className="flex items-start gap-1.5 text-xs text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>
          Túl sok sötét terület került bele: csökkentsd az érzékenységet, vagy fotózd világosabb háttér előtt.</p>
      )}
      <p className="text-[11px] text-slate-500">A képet nem töltjük fel sehova: a gépeden kirajzoljuk belőle a vonalakat, és csak azok maradnak meg.</p>
    </div>
  );
}

// --- Styles ----------------------------------------------------------------------------------

function StylePanel({name, onChange}: {name: string; onChange: (signature: SignatureData | null, style: string | null) => void}) {
  const [ready, setReady] = useState(false);
  const [text, setText] = useState(name);
  const [chosen, setChosen] = useState<SignatureStyle | null>(null);
  const [rendered, setRendered] = useState<SignatureData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadAllStyles().then(() => active && setReady(true), () => active && toast.error("A betűtípusok nem töltődtek be."));
    return () => {
      active = false;
    };
  }, []);

  const choose = async (style: SignatureStyle, value = text) => {
    setChosen(style);
    if (!value.trim()) return;
    setBusy(true);
    try {
      const signature = await renderStyledSignature(value.trim(), style);
      setRendered(signature);
      onChange(signature, style.key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="signature-text" className="text-xs text-slate-400">Szöveg</Label>
          <Input id="signature-text" value={text} maxLength={48} onChange={(event) => setText(event.target.value)}
                 onBlur={() => chosen && void choose(chosen)}/>
        </div>
        <div className="flex flex-wrap gap-1">
          {nameVariants(name).map((variant) => (
            <Button key={variant} type="button" size="sm" variant="ghost" className="h-8 text-xs"
                    onClick={() => {
                      setText(variant);
                      if (chosen) void choose(chosen, variant);
                    }}>{variant}</Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SIGNATURE_STYLES.map((style, index) => (
          <button key={style.key} type="button" onClick={() => void choose(style)} disabled={!ready}
                  style={{"--i": index} as CSSProperties}
                  className={cn("animate-rise group relative flex h-20 min-w-0 items-center justify-center overflow-hidden rounded-xl bg-[#fbf8f1] px-3 ring-2 transition",
                    chosen?.key === style.key ? "ring-amber-400" : "ring-transparent hover:ring-amber-400/40")}>
            {ready ? (
              <span className="truncate" style={{fontFamily: `"${style.family}"`, fontSize: `${30 * style.scale}px`, color: SIGNATURE_INK, lineHeight: 1.6}}>
                {text || name}
              </span>
            ) : <span className="skeleton h-6 w-2/3 rounded"/>}
            <span className="absolute top-1.5 left-2 text-[10px] font-medium text-[#a8a29e]">{style.label}</span>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="relative">
          <Preview signature={rendered}/>
          {busy && <Loader2 className="absolute top-3 right-3 size-4 animate-spin text-[#78716c]"/>}
        </div>
      )}
    </div>
  );
}

// --- Automatic -----------------------------------------------------------------------------

function AutoPanel({name, onChange}: {name: string; onChange: (signature: SignatureData | null, style: string | null) => void}) {
  const [seed, setSeed] = useState(0);
  const [current, setCurrent] = useState<{seed: number; signature: SignatureData | null; style: SignatureStyle; text: string; flourish: Flourish} | null>(null);
  const busy = !current || current.seed !== seed;

  useEffect(() => {
    if (!name.trim()) return;
    let active = true;
    const pick = randomAutoSignature(name);
    renderStyledSignature(pick.text, pick.style, pick.flourish).then((signature) => {
      if (!active) return;
      setCurrent({...pick, seed, signature});
      onChange(signature, pick.style.key);
    }, () => {
      if (active) toast.error("Az aláírás nem készült el. Próbáld újra.");
    });
    return () => {
      active = false;
    };
    // onChange is a fresh closure from the parent; a new seed asks for a new signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, seed]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Preview signature={current?.signature ?? null} caption={name}/>
        {busy && <Loader2 className="absolute top-3 right-3 size-4 animate-spin text-[#78716c]"/>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setSeed((value) => value + 1)} disabled={busy}><Shuffle/> Újat kérek</Button>
        {current && <p className="text-xs text-slate-500">Stílus: {current.style.label} · „{current.text}”</p>}
      </div>
    </div>
  );
}
