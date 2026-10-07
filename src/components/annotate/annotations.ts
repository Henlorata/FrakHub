/**
 * Picture annotation: the shapes drawn over an evidence photo (in the picture's own pixels) and the
 * export that bakes them into a new image. Redactions are pixelated in the export, so the covered
 * part cannot be recovered from the saved picture.
 */

export type AnnotationTool = "select" | "arrow" | "rect" | "ellipse" | "pen" | "text" | "marker" | "redact" | "crop";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Shape =
  | {id: string; kind: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string; width: number}
  | ({id: string; kind: "rect" | "ellipse" | "redact"; color: string; width: number} & Box)
  | {id: string; kind: "pen"; points: number[]; color: string; width: number}
  | {id: string; kind: "text"; x: number; y: number; text: string; color: string; size: number}
  | {id: string; kind: "marker"; x: number; y: number; n: number; color: string; size: number};

export const ANNOTATION_COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ffffff", "#111827"];

/** Stroke, text and marker sizes (small, medium, large) relative to the picture. */
export function sizesFor(width: number, height: number) {
  const base = Math.max(width, height);
  const stroke = [0.0035, 0.006, 0.011].map((ratio) => Math.max(2, Math.round(base * ratio)));
  const text = [0.022, 0.032, 0.048].map((ratio) => Math.max(12, Math.round(base * ratio)));
  const marker = [0.014, 0.02, 0.028].map((ratio) => Math.max(10, Math.round(base * ratio)));
  return {stroke, text, marker};
}

/** A box from two corners (any drag direction). */
export const boxFrom = (x1: number, y1: number, x2: number, y2: number): Box =>
  ({x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)});

/** The arrow's head as three points (tip, left, right). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, width: number): [number, number][] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.max(width * 4.2, 12);
  const spread = Math.PI / 7;
  return [
    [x2, y2],
    [x2 - length * Math.cos(angle - spread), y2 - length * Math.sin(angle - spread)],
    [x2 - length * Math.cos(angle + spread), y2 - length * Math.sin(angle + spread)],
  ];
}

/** Moves a shape by (dx, dy). */
export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.kind) {
    case "arrow":
      return {...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy};
    case "pen":
      return {...shape, points: shape.points.map((value, index) => value + (index % 2 === 0 ? dx : dy))};
    case "text":
    case "marker":
      return {...shape, x: shape.x + dx, y: shape.y + dy};
    default:
      return {...shape, x: shape.x + dx, y: shape.y + dy};
  }
}

/** Pixel block size of a redaction in the export. */
export const redactBlock = (width: number, height: number) => Math.max(8, Math.round(Math.max(width, height) / 80));

function drawShape(context: CanvasRenderingContext2D, shape: Shape) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  switch (shape.kind) {
    case "arrow": {
      context.strokeStyle = shape.color;
      context.fillStyle = shape.color;
      context.lineWidth = shape.width;
      const head = arrowHead(shape.x1, shape.y1, shape.x2, shape.y2, shape.width);
      // The line stops inside the head so its round cap does not poke out of the tip.
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      const inset = Math.max(shape.width * 2, 6);
      context.beginPath();
      context.moveTo(shape.x1, shape.y1);
      context.lineTo(shape.x2 - inset * Math.cos(angle), shape.y2 - inset * Math.sin(angle));
      context.stroke();
      context.beginPath();
      context.moveTo(...head[0]);
      context.lineTo(...head[1]);
      context.lineTo(...head[2]);
      context.closePath();
      context.fill();
      break;
    }
    case "rect":
      context.strokeStyle = shape.color;
      context.lineWidth = shape.width;
      context.strokeRect(shape.x, shape.y, shape.w, shape.h);
      break;
    case "ellipse":
      context.strokeStyle = shape.color;
      context.lineWidth = shape.width;
      context.beginPath();
      context.ellipse(shape.x + shape.w / 2, shape.y + shape.h / 2, Math.max(1, shape.w / 2), Math.max(1, shape.h / 2), 0, 0, Math.PI * 2);
      context.stroke();
      break;
    case "pen":
      if (shape.points.length < 4) break;
      context.strokeStyle = shape.color;
      context.lineWidth = shape.width;
      context.beginPath();
      context.moveTo(shape.points[0], shape.points[1]);
      for (let index = 2; index < shape.points.length; index += 2) context.lineTo(shape.points[index], shape.points[index + 1]);
      context.stroke();
      break;
    case "text":
      context.font = `700 ${shape.size}px Inter, system-ui, sans-serif`;
      context.textBaseline = "middle";
      context.lineWidth = Math.max(2, shape.size * 0.18);
      context.strokeStyle = shape.color === "#111827" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
      context.strokeText(shape.text, shape.x, shape.y);
      context.fillStyle = shape.color;
      context.fillText(shape.text, shape.x, shape.y);
      break;
    case "marker": {
      context.beginPath();
      context.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
      context.fillStyle = shape.color;
      context.fill();
      context.lineWidth = Math.max(2, shape.size * 0.16);
      context.strokeStyle = "#ffffff";
      context.stroke();
      context.font = `800 ${Math.round(shape.size * 1.1)}px Inter, system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = shape.color === "#ffffff" || shape.color === "#facc15" ? "#111827" : "#ffffff";
      context.fillText(String(shape.n), shape.x, shape.y + shape.size * 0.05);
      break;
    }
    default:
      break;
  }
  context.restore();
}

/**
 * Bakes the shapes into the picture (cropped when a crop is set, the longer side at most `maxSide`)
 * and returns a WebP (PNG where the browser cannot encode WebP).
 */
export async function renderAnnotated(image: CanvasImageSource, width: number, height: number, shapes: Shape[], crop: Box | null,
                                      maxSide = 2560): Promise<Blob> {
  const area = crop && crop.w >= 8 && crop.h >= 8 ? crop : {x: 0, y: 0, w: width, h: height};
  const scale = Math.min(1, maxSide / Math.max(area.w, area.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.w * scale));
  canvas.height = Math.max(1, Math.round(area.h * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A böngésző nem tud képet rajzolni.");
  context.scale(scale, scale);
  context.translate(-area.x, -area.y);
  context.drawImage(image, 0, 0, width, height);

  // Redactions first, so the drawings stay on top of them.
  const block = redactBlock(width, height);
  for (const shape of shapes) {
    if (shape.kind !== "redact" || shape.w < 2 || shape.h < 2) continue;
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.ceil(shape.w / block));
    small.height = Math.max(1, Math.ceil(shape.h / block));
    const tiny = small.getContext("2d");
    if (!tiny) continue;
    tiny.drawImage(image, shape.x, shape.y, shape.w, shape.h, 0, 0, small.width, small.height);
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(small, 0, 0, small.width, small.height, shape.x, shape.y, shape.w, shape.h);
    context.restore();
  }
  for (const shape of shapes) if (shape.kind !== "redact") drawShape(context, shape);

  const encode = (type: string, quality?: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.92);
  if (webp && webp.type === "image/webp") return webp;
  const png = await encode("image/png");
  if (!png) throw new Error("A kép mentése nem sikerült.");
  return png;
}
