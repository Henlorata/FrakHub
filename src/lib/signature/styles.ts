import alexBrush from "@/assets/fonts/signature/alex-brush-latin.woff2";
import alexBrushExt from "@/assets/fonts/signature/alex-brush-latin-ext.woff2";
import allura from "@/assets/fonts/signature/allura-latin.woff2";
import alluraExt from "@/assets/fonts/signature/allura-latin-ext.woff2";
import greatVibes from "@/assets/fonts/signature/great-vibes-latin.woff2";
import greatVibesExt from "@/assets/fonts/signature/great-vibes-latin-ext.woff2";
import herrVonMuellerhoff from "@/assets/fonts/signature/herr-von-muellerhoff-latin.woff2";
import herrVonMuellerhoffExt from "@/assets/fonts/signature/herr-von-muellerhoff-latin-ext.woff2";
import monsieur from "@/assets/fonts/signature/monsieur-la-doulaise-latin.woff2";
import monsieurExt from "@/assets/fonts/signature/monsieur-la-doulaise-latin-ext.woff2";
import mrDafoe from "@/assets/fonts/signature/mr-dafoe-latin.woff2";
import mrDafoeExt from "@/assets/fonts/signature/mr-dafoe-latin-ext.woff2";
import parisienne from "@/assets/fonts/signature/parisienne-latin.woff2";
import parisienneExt from "@/assets/fonts/signature/parisienne-latin-ext.woff2";
import sacramento from "@/assets/fonts/signature/sacramento-latin.woff2";
import sacramentoExt from "@/assets/fonts/signature/sacramento-latin-ext.woff2";
import {outlinesToSignature, type SignatureData} from "./geometry";
import {alphaMask, removeSpecks, traceOutlines} from "./trace";

/**
 * Handwriting styles for a signature from the member's name (SIL Open Font License fonts, bundled;
 * loaded only when the signature editor opens). A chosen style is rendered once and traced into the
 * same vector outlines as a drawn signature, so documents never need the fonts.
 */

export interface SignatureStyle {
  key: string;
  label: string;
  family: string;
  files: [string, string];
  /** Font size multiplier (the fonts differ a lot in their x-height). */
  scale: number;
  /** Used by the automatic signature. */
  auto: boolean;
}

export const SIGNATURE_STYLES: SignatureStyle[] = [
  {key: "herr-von-muellerhoff", label: "Lendületes", family: "Sig Herr Von Muellerhoff", files: [herrVonMuellerhoff, herrVonMuellerhoffExt], scale: 1.25, auto: true},
  {key: "mr-dafoe", label: "Határozott", family: "Sig Mr Dafoe", files: [mrDafoe, mrDafoeExt], scale: 1.05, auto: true},
  {key: "great-vibes", label: "Elegáns", family: "Sig Great Vibes", files: [greatVibes, greatVibesExt], scale: 1, auto: true},
  {key: "allura", label: "Finom", family: "Sig Allura", files: [allura, alluraExt], scale: 1.05, auto: true},
  {key: "alex-brush", label: "Ecsetes", family: "Sig Alex Brush", files: [alexBrush, alexBrushExt], scale: 1, auto: true},
  {key: "monsieur-la-doulaise", label: "Díszes", family: "Sig Monsieur La Doulaise", files: [monsieur, monsieurExt], scale: 1.05, auto: false},
  {key: "sacramento", label: "Vékony", family: "Sig Sacramento", files: [sacramento, sacramentoExt], scale: 1.15, auto: false},
  {key: "parisienne", label: "Laza", family: "Sig Parisienne", files: [parisienne, parisienneExt], scale: 0.95, auto: false},
];

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

const loaded = new Map<string, Promise<void>>();

/** Registers and loads a style's font (once per page). */
export function loadStyle(style: SignatureStyle): Promise<void> {
  let pending = loaded.get(style.key);
  if (!pending) {
    pending = (async () => {
      const faces = [
        new FontFace(style.family, `url(${style.files[0]}) format("woff2")`, {unicodeRange: LATIN}),
        new FontFace(style.family, `url(${style.files[1]}) format("woff2")`, {unicodeRange: LATIN_EXT}),
      ];
      for (const face of faces) document.fonts.add(face);
      await Promise.all(faces.map((face) => face.load()));
    })();
    loaded.set(style.key, pending);
    pending.catch(() => loaded.delete(style.key));
  }
  return pending;
}

export const loadAllStyles = () => Promise.all(SIGNATURE_STYLES.map(loadStyle));

/** A flourish under or through the name: a tapering pen line along a cubic curve. */
export interface Flourish {
  /** 0 = none, 1 = underline swash, 2 = loop back from the last letter. */
  kind: 0 | 1 | 2;
  /** -1–1: how far it swings. */
  swing: number;
}

const FONT_SIZE = 150;

function drawFlourish(ctx: CanvasRenderingContext2D, flourish: Flourish, box: {left: number; right: number; baseline: number; size: number}) {
  if (flourish.kind === 0) return;
  const {left, right, baseline, size} = box;
  const span = right - left;
  const swing = flourish.swing * size * 0.18;
  const points: [number, number][] = flourish.kind === 1
    ? [[left + span * 0.05, baseline + size * 0.16 + swing], [left + span * 0.35, baseline + size * 0.32], [left + span * 0.75, baseline + size * 0.02 - swing], [right + size * 0.25, baseline + size * 0.08]]
    : [[right - size * 0.15, baseline - size * 0.05], [right + size * 0.55, baseline + size * 0.32 + swing], [left + span * 0.4, baseline + size * 0.42], [left + span * 0.15, baseline + size * 0.12 - swing]];
  const steps = 64;
  const at = (t: number) => {
    const u = 1 - t;
    const [p0, p1, p2, p3] = points;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ] as const;
  };
  ctx.lineCap = "round";
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const [x0, y0] = at(t0);
    const [x1, y1] = at(t1);
    // Thick in the middle, thin at both ends.
    ctx.lineWidth = Math.max(1.2, size * 0.045 * Math.sin(Math.PI * ((t0 + t1) / 2)) ** 0.7);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

/** Renders the text in a style (with an optional flourish) and traces it into signature data. */
export async function renderStyledSignature(text: string, style: SignatureStyle, flourish: Flourish = {kind: 0, swing: 0}): Promise<SignatureData | null> {
  await loadStyle(style);
  const size = FONT_SIZE * style.scale;
  const font = `${size}px "${style.family}"`;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const metrics = probe.measureText(text);
  const padding = size * 0.9;
  const width = Math.ceil(metrics.width + padding * 2);
  const height = Math.ceil(size * 2.4);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textBaseline = "alphabetic";
  const baseline = Math.round(height * 0.58);
  ctx.fillText(text, padding, baseline);
  drawFlourish(ctx, flourish, {left: padding, right: padding + metrics.width, baseline, size});
  const mask = alphaMask(ctx.getImageData(0, 0, width, height).data);
  removeSpecks(mask, width, height, 6);
  return outlinesToSignature({outlines: traceOutlines(mask, width, height), tolerance: 0.55});
}

/** Variants of the name for the automatic signature: full name, initial + surname, surname. */
export function nameVariants(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [fullName.trim()];
  const last = parts[parts.length - 1];
  return [...new Set([parts.join(" "), `${parts[0][0]}. ${last}`, `${parts[0]} ${last}`])];
}

/** A random but tasteful pick: a signature-like style, a variant of the name and a flourish. */
export function randomAutoSignature(fullName: string, random = Math.random) {
  const styles = SIGNATURE_STYLES.filter((style) => style.auto);
  const style = styles[Math.floor(random() * styles.length)];
  const variants = nameVariants(fullName);
  const text = variants[Math.floor(random() * variants.length)];
  const flourish: Flourish = {kind: (random() < 0.15 ? 0 : random() < 0.6 ? 1 : 2) as Flourish["kind"], swing: random() * 2 - 1};
  return {style, text, flourish};
}
