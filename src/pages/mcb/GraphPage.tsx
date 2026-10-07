import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent} from "react";
import {Link, useNavigate, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowRight, ExternalLink, Expand, List, Loader2, LocateFixed, Maximize2, Search, Share2, Siren, Waypoints, X,
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useSuspects} from "@/context/SuspectCacheContext";
import {
  GRAPH_KINDS, graphApi, mergeGraph, nodeColor, WANTED_COLOR, type GraphData, type GraphKind, type GraphNode, type GraphSearchHit,
} from "@/lib/graph";
import {involvementLook, PROPERTY_TYPE} from "@/lib/mcb";
import {ORG_ROLES, type OrgRole} from "@/lib/organizations";
import {cn, errorMessage} from "@/lib/utils";
import {usePrefersReducedMotion} from "@/pages/home/motion";
import {bounds, seedPositions, settle, tick, type Point, type SimLink, type SimNode} from "./graph-layout";

const KIND_ORDER: GraphKind[] = ["person", "org", "case", "plate", "address"];
const edgeId = (source: string, target: string, label: string | null) => `${source}|${target}|${label ?? ""}`;
const short = (text: string, max = 26) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** An edge's label in Hungarian: the role in an organisation, the part in a case, the type of a property. */
function linkLabel(label: string | null, kinds: GraphKind[]): string | null {
  if (!label) return null;
  if (kinds.includes("org")) return ORG_ROLES[label as OrgRole] ?? label;
  if (kinds.includes("case")) return involvementLook(label).label;
  if (kinds.includes("address")) return PROPERTY_TYPE[label] ?? label;
  return label;
}

/**
 * The MCB's relationship graph: who is connected to whom, through which organisation, case,
 * vehicle (plate) or address. Start from any of them; a node can be opened, put in the middle or
 * expanded. The network settles visibly (instantly with reduced motion) and the list view shows
 * the same as a table.
 */
export function GraphPage() {
  const [params, setParams] = useSearchParams();
  const start = params.get("node");
  const navigate = useNavigate();
  const {openSuspectId} = useSuspects();
  const reduced = usePrefersReducedMotion();
  const [loaded, setLoaded] = useState<GraphData | null>(null);
  // The starting point and depth of the last finished read, and whether a node is being expanded.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [depth, setDepth] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [positions, setPositions] = useState<Map<string, Point>>(() => new Map());
  const [viewBox, setViewBox] = useState("-400 -300 800 600");
  const [generation, setGeneration] = useState(0);

  const sim = useRef<SimNode[]>([]);
  const links = useRef<SimLink[]>([]);
  const frame = useRef(0);
  const svg = useRef<SVGSVGElement>(null);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const edgeEls = useRef(new Map<string, SVGLineElement>());
  const labelEls = useRef(new Map<string, SVGTextElement>());
  const box = useRef({x: -400, y: -300, w: 800, h: 600});

  // --- Layout --------------------------------------------------------------------------------------

  const paint = useCallback(() => {
    const at = new Map(sim.current.map((node) => [node.key, node]));
    for (const node of sim.current) nodeEls.current.get(node.key)?.setAttribute("transform", `translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`);
    edgeEls.current.forEach((line, key) => {
      const [source, target] = key.split("|");
      const a = at.get(source);
      const b = at.get(target);
      if (!a || !b) return;
      line.setAttribute("x1", a.x.toFixed(1));
      line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", b.x.toFixed(1));
      line.setAttribute("y2", b.y.toFixed(1));
    });
    labelEls.current.forEach((text, key) => {
      const [source, target] = key.split("|");
      const a = at.get(source);
      const b = at.get(target);
      if (!a || !b) return;
      text.setAttribute("x", ((a.x + b.x) / 2).toFixed(1));
      text.setAttribute("y", ((a.y + b.y) / 2 - 4).toFixed(1));
    });
  }, []);

  const fit = useCallback((nodes: Point[]) => {
    const area = bounds(nodes);
    const rect = svg.current?.getBoundingClientRect();
    const width = Math.max(area.width, (rect?.width ?? 800) * 0.95);
    const height = Math.max(area.height, (rect?.height ?? 600) * 0.95);
    const x = area.x - (width - area.width) / 2;
    const y = area.y - (height - area.height) / 2;
    box.current = {x, y, w: width, h: height};
    setViewBox(`${x} ${y} ${width} ${height}`);
    svg.current?.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  }, []);

  const animate = useCallback((alpha: number) => {
    cancelAnimationFrame(frame.current);
    if (reduced) {
      settle(sim.current, links.current, 120);
      paint();
      setPositions(new Map(sim.current.map((node) => [node.key, {x: node.x, y: node.y}])));
      return;
    }
    let heat = alpha;
    const step = () => {
      for (let i = 0; i < 2; i++) {
        tick(sim.current, links.current, heat);
        heat *= 0.982;
      }
      paint();
      if (heat > 0.015) frame.current = requestAnimationFrame(step);
      else setPositions(new Map(sim.current.map((node) => [node.key, {x: node.x, y: node.y}])));
    };
    frame.current = requestAnimationFrame(step);
  }, [paint, reduced]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** New data on screen: keeps the known places, seeds the new ones, then lets the network settle. */
  const layout = useCallback((data: GraphData, fresh: boolean) => {
    const previous = new Map(sim.current.map((node) => [node.key, {x: node.x, y: node.y}]));
    links.current = data.edges.map((edge) => ({source: edge.source, target: edge.target}));
    sim.current = seedPositions(data.nodes.map((node) => node.key), links.current, data.center, fresh ? new Map() : previous);
    if (fresh) {
      // Most of the cooling happens off screen, so the view can be fitted; the rest is the visible settling.
      settle(sim.current, links.current, 160);
      fit(sim.current);
    }
    setPositions(new Map(sim.current.map((node) => [node.key, {x: node.x, y: node.y}])));
    setGeneration((value) => value + 1);
    requestAnimationFrame(() => animate(fresh ? 0.35 : 0.55));
  }, [animate, fit]);

  // --- Data ----------------------------------------------------------------------------------------

  const request = start ? `${start}|${depth}` : null;
  const graph = start ? loaded : null;
  const loading = expanding || (request !== null && loadedFor !== request);

  useEffect(() => {
    if (!start) return;
    let active = true;
    const key = `${start}|${depth}`;
    graphApi.graph(start, depth).then((data) => {
      if (!active) return;
      setLoadedFor(key);
      if (!data) {
        setLoaded(null);
        toast.error("Ez az elem nem található.");
        return;
      }
      setSelected(start);
      setLoaded(data);
      layout(data, true);
    }, (error) => {
      if (!active) return;
      setLoadedFor(key);
      toast.error(errorMessage(error, "A kapcsolati háló nem tölthető be."));
    });
    return () => {
      active = false;
    };
  }, [start, depth, layout]);

  const expand = async (key: string) => {
    setExpanding(true);
    try {
      const data = await graphApi.graph(key, 1);
      if (!data) return;
      const next = mergeGraph(graph, data);
      const added = next.nodes.length - (graph?.nodes.length ?? 0);
      setLoaded(next);
      layout(next, false);
      toast.success(added > 0 ? `${added} új kapcsolat a hálón.` : "Nincs több kapcsolata.");
    } catch (error) {
      toast.error(errorMessage(error, "A bővítés nem sikerült."));
    } finally {
      setExpanding(false);
    }
  };

  // --- Derived ---------------------------------------------------------------------------------

  const nodes = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.key, node])), [graph]);
  const neighbours = useMemo(() => {
    const map = new Map<string, {key: string; label: string | null}[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.source, [...(map.get(edge.source) ?? []), {key: edge.target, label: edge.label}]);
      map.set(edge.target, [...(map.get(edge.target) ?? []), {key: edge.source, label: edge.label}]);
    }
    return map;
  }, [graph]);
  // Distance from the centre: the entrance ripples outwards.
  const distance = useMemo(() => {
    const result = new Map<string, number>();
    if (!graph) return result;
    const queue = [graph.center];
    result.set(graph.center, 0);
    while (queue.length) {
      const key = queue.shift()!;
      for (const next of neighbours.get(key) ?? []) {
        if (!result.has(next.key)) {
          result.set(next.key, result.get(key)! + 1);
          queue.push(next.key);
        }
      }
    }
    return result;
  }, [graph, neighbours]);

  // Pointing at a node dims the rest; a selected node only lights its own links.
  const focus = hovered ?? selected;
  const lit = useMemo(() => {
    if (!hovered) return null;
    return new Set([hovered, ...(neighbours.get(hovered) ?? []).map((item) => item.key)]);
  }, [hovered, neighbours]);

  const counts = useMemo(() => {
    const result: Record<GraphKind, number> = {person: 0, org: 0, case: 0, plate: 0, address: 0};
    for (const node of graph?.nodes ?? []) result[node.kind] += 1;
    return result;
  }, [graph]);

  // --- Pointer: pan, zoom, drag --------------------------------------------------------------------

  const toSvg = (clientX: number, clientY: number): Point => {
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return {x: 0, y: 0};
    const point = element.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const result = point.matrixTransform(matrix.inverse());
    return {x: result.x, y: result.y};
  };

  const applyBox = () => svg.current?.setAttribute("viewBox", `${box.current.x} ${box.current.y} ${box.current.w} ${box.current.h}`);

  const drag = useRef<{kind: "pan"; startX: number; startY: number; box: typeof box.current} | {kind: "node"; key: string; moved: boolean} | null>(null);

  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = {kind: "pan", startX: event.clientX, startY: event.clientY, box: {...box.current}};
  };
  const onNodeDown = (event: ReactPointerEvent<SVGGElement>, key: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    drag.current = {kind: "node", key, moved: false};
  };
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (!state) return;
    if (state.kind === "pan") {
      const rect = svg.current!.getBoundingClientRect();
      const scale = Math.min(rect.width / state.box.w, rect.height / state.box.h);
      box.current = {...state.box, x: state.box.x - (event.clientX - state.startX) / scale, y: state.box.y - (event.clientY - state.startY) / scale};
      applyBox();
    } else {
      const node = sim.current.find((item) => item.key === state.key);
      if (!node) return;
      const point = toSvg(event.clientX, event.clientY);
      node.x = point.x;
      node.y = point.y;
      node.pinned = true;
      state.moved = true;
      paint();
    }
  };
  const onUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    drag.current = null;
    if (state?.kind === "node") {
      if (state.moved) animate(0.25);
      else setSelected((current) => (current === state.key ? null : state.key));
    } else if (state?.kind === "pan" && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) {
      // A click on the background (not a drag) clears the selection.
      setSelected(null);
    }
  };
  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return;
    const point = element.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const at = point.matrixTransform(matrix.inverse());
    const factor = Math.exp(event.deltaY * 0.0015);
    const current = box.current;
    const w = Math.min(Math.max(current.w * factor, 160), 6000);
    const h = current.h * (w / current.w);
    box.current = {x: at.x - (at.x - current.x) * (w / current.w), y: at.y - (at.y - current.y) * (h / current.h), w, h};
    element.setAttribute("viewBox", `${box.current.x} ${box.current.y} ${box.current.w} ${box.current.h}`);
  }, []);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    element.addEventListener("wheel", onWheel, {passive: false});
    return () => element.removeEventListener("wheel", onWheel);
  }, [onWheel, view, graph]);

  const zoom = (factor: number) => {
    const current = box.current;
    const w = Math.min(Math.max(current.w * factor, 160), 6000);
    const h = current.h * (w / current.w);
    box.current = {x: current.x + (current.w - w) / 2, y: current.y + (current.h - h) / 2, w, h};
    applyBox();
  };

  const recenter = (key: string) => setParams({node: key});
  const openNode = (node: GraphNode) => {
    if (node.kind === "person" && node.id) openSuspectId(node.id);
    else if (node.kind === "org" && node.id) navigate(`/mcb/organizations/${node.id}`);
    else if (node.kind === "case" && node.id && node.can_open) navigate(`/mcb/case/${node.id}`);
  };

  const selectedNode = selected ? nodes.get(selected) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5 pb-10">
      <PageHeader icon={Waypoints} tone="violet" eyebrow="Major Crimes Bureau" title="Kapcsolati háló"
                  description="Kik kapcsolódnak egymáshoz, és min keresztül: szervezet, akta, közös jármű vagy cím. Indulj egy személyből, szervezetből, aktából, rendszámból vagy címből."/>

      <div className="flex flex-wrap items-center gap-3">
        <GraphSearch onPick={(hit) => recenter(hit.key)}/>
        {graph && (
          <>
            <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="group" aria-label="Mélység">
              {[1, 2, 3].map((value) => (
                <button key={value} type="button" aria-pressed={depth === value} onClick={() => setDepth(value)}
                        className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors", depth === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                  {value} lépés
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="group" aria-label="Nézet">
              {([["graph", "Háló", Share2], ["list", "Lista", List]] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
                        className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                          view === key ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                  <Icon className="size-3.5"/> {label}
                </button>
              ))}
            </div>
            {loading && <Loader2 className="size-4 animate-spin text-slate-500"/>}
          </>
        )}
      </div>

      {!start ? (
        <div className="panel flex min-h-[26rem] flex-col items-center justify-center gap-4 p-10 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30"><Waypoints className="size-8"/></span>
          <p className="text-lg font-semibold text-white">Kezdd egy névvel, rendszámmal vagy címmel</p>
          <p className="max-w-md text-sm text-slate-400">
            A háló a nyilvántartásból épül: társak, szervezeti tagság, akták, közös járművek és címek. Egy elemre kattintva megnyithatod, középre teheted vagy bővítheted.
          </p>
        </div>
      ) : !graph ? (
        <div className="panel flex min-h-[26rem] items-center justify-center">{loading ? <Loader2 className="size-8 animate-spin text-slate-500"/> : <p className="text-sm text-slate-500">Nincs adat.</p>}</div>
      ) : view === "list" ? (
        <GraphList graph={graph} neighbours={neighbours} onPick={(key) => {
          setSelected(key);
          setView("graph");
        }}/>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div data-tour="graph-canvas" className="panel relative h-[min(72vh,760px)] min-h-[26rem] overflow-hidden p-0">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(139_92_246/0.08),transparent_60%)]"/>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]"/>
            <svg ref={svg} key={generation > 0 ? "graph" : "empty"} viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
                 className="relative size-full cursor-grab touch-none select-none active:cursor-grabbing" role="img"
                 aria-label={`Kapcsolati háló: ${graph.nodes.length} elem, ${graph.edges.length} kapcsolat`}
                 onPointerDown={onBackgroundDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <g>
                {graph.edges.map((edge) => {
                  const key = edgeId(edge.source, edge.target, edge.label);
                  const a = positions.get(edge.source);
                  const b = positions.get(edge.target);
                  const on = edge.source === focus || edge.target === focus;
                  return (
                    <line key={key} ref={(element) => {
                      if (element) edgeEls.current.set(key, element);
                      else edgeEls.current.delete(key);
                    }} x1={a?.x ?? 0} y1={a?.y ?? 0} x2={b?.x ?? 0} y2={b?.y ?? 0}
                          className="graph-edge-in transition-[stroke,stroke-opacity] duration-300"
                          style={{"--d": Math.max(distance.get(edge.source) ?? 0, distance.get(edge.target) ?? 0)} as CSSProperties}
                          stroke={on ? "#fcd34d" : "#94a3b8"} strokeOpacity={on ? 0.85 : lit ? 0.08 : 0.3} strokeWidth={on ? 2 : 1.4}/>
                  );
                })}
              </g>
              <g>
                {graph.nodes.map((node) => (
                  <GraphNodeShape key={node.key} node={node} at={positions.get(node.key)} depth={distance.get(node.key) ?? 0}
                                  center={node.key === graph.center} selected={node.key === selected}
                                  dimmed={!!lit && !lit.has(node.key)}
                                  register={(element) => {
                                    if (element) nodeEls.current.set(node.key, element);
                                    else nodeEls.current.delete(node.key);
                                  }}
                                  onPointerDown={(event) => onNodeDown(event, node.key)}
                                  onHover={(on) => setHovered(on ? node.key : null)}
                                  onKeySelect={() => setSelected(node.key)}/>
                ))}
              </g>
              {hovered && graph.edges.filter((edge) => edge.label && (edge.source === hovered || edge.target === hovered)).map((edge) => {
                const pa = positions.get(edge.source);
                const pb = positions.get(edge.target);
                if (!pa || !pb) return null;
                const id = edgeId(edge.source, edge.target, edge.label);
                return (
                  <text key={`label-${id}`} x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 4} textAnchor="middle"
                        ref={(element) => {
                          if (element) labelEls.current.set(id, element);
                          else labelEls.current.delete(id);
                        }}
                        className="pointer-events-none animate-fade fill-amber-100 text-[10px] font-medium [paint-order:stroke] [stroke-linejoin:round]"
                        stroke="#050a17" strokeWidth={4}>
                    {short(linkLabel(edge.label, [nodes.get(edge.source)?.kind, nodes.get(edge.target)?.kind].filter(Boolean) as GraphKind[]) ?? "", 30)}
                  </text>
                );
              })}
            </svg>

            <div className="absolute bottom-3 left-3 flex flex-col gap-1">
              <Button size="icon-sm" variant="outline" aria-label="Nagyítás" onClick={() => zoom(0.8)}>+</Button>
              <Button size="icon-sm" variant="outline" aria-label="Kicsinyítés" onClick={() => zoom(1.25)}>−</Button>
              <Button size="icon-sm" variant="outline" aria-label="Igazítás" onClick={() => fit(sim.current)}><Maximize2/></Button>
            </div>
            <Legend counts={counts}/>
            {graph.truncated && (
              <p className="absolute top-3 left-3 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100 ring-1 ring-amber-500/25">
                A háló nagy: 150 elemnél megálltunk. Bővíts egy-egy elemet külön.
              </p>
            )}
          </div>

          <aside className="panel h-fit space-y-4 p-4 xl:sticky xl:top-20">
            {selectedNode ? (
              <NodeDetails node={selectedNode} links={neighbours.get(selectedNode.key) ?? []} nodes={nodes}
                           isCenter={selectedNode.key === graph.center}
                           onSelect={setSelected} onCenter={() => recenter(selectedNode.key)} onExpand={() => void expand(selectedNode.key)}
                           onOpen={() => openNode(selectedNode)} onClose={() => setSelected(null)}/>
            ) : (
              <div className="space-y-3 text-sm text-slate-400">
                <p className="font-semibold text-white">{graph.nodes.length} elem, {graph.edges.length} kapcsolat</p>
                <p>Kattints egy elemre a részletekért. Az elemeket húzhatod, a hálót görgetéssel nagyíthatod és a háttér húzásával mozgathatod.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

// --- Pieces ---------------------------------------------------------------------------------------

function GraphNodeShape({node, at, depth, center, selected, dimmed, register, onPointerDown, onHover, onKeySelect}: {
  node: GraphNode; at: Point | undefined; depth: number; center: boolean; selected: boolean; dimmed: boolean;
  register: (element: SVGGElement | null) => void;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onHover: (on: boolean) => void;
  onKeySelect: () => void;
}) {
  const color = nodeColor(node);
  const wanted = node.kind === "person" && node.status === "wanted";
  const ring = wanted ? WANTED_COLOR : color;
  const Icon = GRAPH_KINDS[node.kind].icon;
  const size = center ? 26 : 21;
  const clip = `clip-${node.key.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <g ref={register} transform={`translate(${(at?.x ?? 0).toFixed(1)} ${(at?.y ?? 0).toFixed(1)})`}
       onPointerDown={onPointerDown} onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}
       tabIndex={0} role="button" aria-label={`${GRAPH_KINDS[node.kind].label}: ${node.label}${wanted ? " (körözött)" : ""}`}
       onKeyDown={(event) => {
         if (event.key === "Enter" || event.key === " ") {
           event.preventDefault();
           onKeySelect();
         }
       }}
       className={cn("cursor-pointer outline-none transition-opacity duration-300", dimmed && "opacity-25")}>
      <g className="graph-node-in" style={{"--d": depth} as CSSProperties}>
        {(selected || center) && (
          <circle r={size + 9} fill="none" stroke={selected ? "#fcd34d" : ring} strokeOpacity={selected ? 0.9 : 0.35} strokeWidth={selected ? 2 : 1.5}
                  className={cn(selected && "graph-pulse")}/>
        )}
        {node.kind === "plate" ? (
          <>
            <rect x={-40} y={-15} width={80} height={30} rx={7} fill="#0b1220" stroke={color} strokeWidth={2}/>
            <rect x={-40} y={-15} width={80} height={30} rx={7} fill={color} fillOpacity={0.14}/>
            <text textAnchor="middle" y={4.5} className="fill-amber-50 font-mono text-[12px] font-bold tracking-wider">{short(node.label, 10)}</text>
          </>
        ) : node.kind === "case" ? (
          <>
            <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={8} fill="#0b1220" stroke={color} strokeWidth={2}/>
            <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={8} fill={color} fillOpacity={0.16}/>
            <Icon x={-9} y={-9} width={18} height={18} color={color} strokeWidth={2.2}/>
          </>
        ) : node.kind === "org" ? (
          <>
            <polygon points={hexagon(size + 3)} fill="#0b1220" stroke={color} strokeWidth={2.2}/>
            <polygon points={hexagon(size + 3)} fill={color} fillOpacity={0.18}/>
            {node.image ? (
              <>
                <clipPath id={clip}><circle r={size - 5}/></clipPath>
                <image href={node.image} x={-(size - 5)} y={-(size - 5)} width={(size - 5) * 2} height={(size - 5) * 2} clipPath={`url(#${clip})`}
                       preserveAspectRatio="xMidYMid slice"/>
              </>
            ) : <text textAnchor="middle" y={5} className="text-[13px] font-bold" fill={color}>{initials(node.label)}</text>}
          </>
        ) : (
          <>
            <circle r={size} fill="#0b1220" stroke={ring} strokeWidth={wanted ? 3 : 2.2}/>
            <circle r={size} fill={ring} fillOpacity={0.14}/>
            {node.kind === "person" && node.image ? (
              <>
                <clipPath id={clip}><circle r={size - 3}/></clipPath>
                <image href={node.image} x={-(size - 3)} y={-(size - 3)} width={(size - 3) * 2} height={(size - 3) * 2} clipPath={`url(#${clip})`}
                       preserveAspectRatio="xMidYMid slice"/>
              </>
            ) : node.kind === "person" ? (
              <text textAnchor="middle" y={4.5} className="text-[12px] font-bold" fill="#dbeafe">{initials(node.label)}</text>
            ) : (
              <Icon x={-8} y={-8} width={16} height={16} color={color} strokeWidth={2.2}/>
            )}
            {wanted && (
              <g transform={`translate(${size * 0.72} ${-size * 0.72})`}>
                <circle r={7} fill={WANTED_COLOR}/>
                <text textAnchor="middle" y={3.5} className="fill-white text-[10px] font-black">!</text>
              </g>
            )}
          </>
        )}
        <text textAnchor="middle" y={node.kind === "plate" ? 30 : size + 16}
              className={cn("pointer-events-none text-[11.5px] [paint-order:stroke] [stroke-linejoin:round]", center || selected ? "fill-white font-semibold" : "fill-slate-200")}
              stroke="#050a17" strokeWidth={4}>
          {short(node.kind === "case" && node.title ? `${node.label} · ${node.title}` : node.label, node.kind === "case" ? 30 : 24)}
          <title>{[node.label, node.title, node.alias].filter(Boolean).join(" · ")}</title>
        </text>
      </g>
    </g>
  );
}

const hexagon = (radius: number) => Array.from({length: 6}, (_, index) => {
  const angle = (Math.PI / 3) * index - Math.PI / 6;
  return `${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius).toFixed(1)}`;
}).join(" ");

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

function Legend({counts}: {counts: Record<GraphKind, number>}) {
  return (
    <div className="absolute right-3 bottom-3 flex flex-wrap justify-end gap-x-3 gap-y-1 rounded-lg bg-[#050a17]/80 px-3 py-2 text-[11px] text-slate-300 ring-1 ring-white/10 backdrop-blur">
      {KIND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => {
        const meta = GRAPH_KINDS[kind];
        return (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <meta.icon className="size-3.5" style={{color: meta.color}}/> {meta.plural} <span className="tabular-nums text-slate-500">{counts[kind]}</span>
          </span>
        );
      })}
      <span className="inline-flex items-center gap-1.5"><Siren className="size-3.5" style={{color: WANTED_COLOR}}/> Körözött</span>
    </div>
  );
}

function NodeDetails({node, links, nodes, isCenter, onSelect, onCenter, onExpand, onOpen, onClose}: {
  node: GraphNode; links: {key: string; label: string | null}[]; nodes: Map<string, GraphNode>; isCenter: boolean;
  onSelect: (key: string) => void; onCenter: () => void; onExpand: () => void; onOpen: () => void; onClose: () => void;
}) {
  const meta = GRAPH_KINDS[node.kind];
  const color = nodeColor(node);
  const openable = (node.kind === "person" || node.kind === "org") && !!node.id || (node.kind === "case" && !!node.can_open);
  const grouped = KIND_ORDER.map((kind) => ({kind, items: links.filter((link) => nodes.get(link.key)?.kind === kind)})).filter((group) => group.items.length);
  return (
    <div className="animate-fade space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl ring-1" style={{color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}55`}}>
          <meta.icon className="size-5"/>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{meta.label}</p>
          <p className="font-semibold wrap-anywhere text-white">{node.label}</p>
          {(node.title || node.alias) && <p className="text-xs wrap-anywhere text-slate-400">{node.alias ? `„${node.alias}”` : node.title}</p>}
          {node.kind === "person" && node.status === "wanted" && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-500/30">
              <Siren className="size-3"/> Körözött
            </span>
          )}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Bezárás" onClick={onClose}><X/></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {openable && <Button size="sm" onClick={onOpen}><ExternalLink/> Megnyitás</Button>}
        {!isCenter && <Button size="sm" variant="outline" onClick={onCenter}><LocateFixed/> Középre</Button>}
        <Button size="sm" variant="outline" onClick={onExpand}><Expand/> Bővítés</Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Kapcsolatok ({links.length})</p>
        {grouped.length === 0 ? <p className="text-sm text-slate-500">Nincs kapcsolata a hálón.</p> : grouped.map((group) => (
          <div key={group.kind}>
            <p className="mb-1 text-[11px] text-slate-500">{GRAPH_KINDS[group.kind].plural}</p>
            <ul className="space-y-0.5">
              {group.items.map((link) => {
                const other = nodes.get(link.key);
                if (!other) return null;
                return (
                  <li key={`${link.key}-${link.label ?? ""}`}>
                    <button type="button" onClick={() => onSelect(link.key)}
                            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                      <span className="min-w-0 flex-1 truncate text-slate-100">{other.label}</span>
                      {link.label && <span className="shrink-0 truncate text-[11px] text-slate-500">{short(linkLabel(link.label, [node.kind, other.kind]) ?? "", 18)}</span>}
                      <ArrowRight className="size-3.5 shrink-0 text-slate-600"/>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The same data as a table (keyboard and screen reader friendly). */
function GraphList({graph, neighbours, onPick}: {
  graph: GraphData; neighbours: Map<string, {key: string; label: string | null}[]>; onPick: (key: string) => void;
}) {
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] tracking-wider text-slate-500 uppercase">
          <tr className="border-b border-white/5">
            <th className="px-4 py-3 font-semibold">Elem</th>
            <th className="px-4 py-3 font-semibold">Fajta</th>
            <th className="px-4 py-3 font-semibold">Kapcsolatok</th>
          </tr>
        </thead>
        <tbody>
          {KIND_ORDER.flatMap((kind) => graph.nodes.filter((node) => node.kind === kind)).map((node) => (
            <tr key={node.key} className="border-b border-white/5 align-top">
              <td className="px-4 py-2.5">
                <button type="button" onClick={() => onPick(node.key)} className="text-left font-medium text-white hover:text-violet-200">
                  {node.label}{node.kind === "person" && node.status === "wanted" && <span className="ml-1.5 text-[11px] font-semibold text-red-300">körözött</span>}
                </button>
                {node.title && <p className="text-xs text-slate-500">{node.title}</p>}
              </td>
              <td className="px-4 py-2.5 text-slate-400">{GRAPH_KINDS[node.kind].label}</td>
              <td className="px-4 py-2.5 text-slate-300">
                {(neighbours.get(node.key) ?? []).map((link) => {
                  const other = byKey.get(link.key);
                  const label = linkLabel(link.label, other ? [node.kind, other.kind] : [node.kind]);
                  return `${other?.label ?? "?"}${label ? ` (${label})` : ""}`;
                }).join(", ") || "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GraphSearch({onPick}: {onPick: (hit: GraphSearchHit) => void}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<GraphSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      graphApi.search(query).then((list) => {
        if (!active) return;
        setHits(list ?? []);
        setOpen(true);
      }, () => undefined).finally(() => active && setBusy(false));
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  const shown = term.trim().length >= 2 ? hits : [];
  return (
    <div className="relative w-full sm:w-96">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
      <Input value={term} onChange={(event) => setTerm(event.target.value)} onFocus={() => setOpen(true)}
             onBlur={() => window.setTimeout(() => setOpen(false), 150)}
             placeholder="Név, szervezet, ügyszám, rendszám, cím…" aria-label="Kezdőpont keresése" className="pl-9"/>
      {busy && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-500"/>}
      {open && shown.length > 0 && (
        <ul aria-label="Találatok" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] p-1 shadow-2xl">
          {shown.map((hit) => {
            const meta = GRAPH_KINDS[hit.kind];
            return (
              <li key={hit.key}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                  onPick(hit);
                  setOpen(false);
                }} className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5">
                  <meta.icon className="size-4 shrink-0" style={{color: meta.color}}/>
                  <span className="min-w-0 flex-1 truncate text-slate-100">{hit.label}</span>
                  {hit.title && <span className="max-w-[40%] shrink-0 truncate text-xs text-slate-500">{hit.title}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A link to the graph around a node (for the person's file, the organisation's page). */
export function GraphLink({nodeKey, className}: {nodeKey: string; className?: string}) {
  return (
    <Button size="sm" variant="outline" asChild className={className}>
      <Link to={`/mcb/graph?node=${encodeURIComponent(nodeKey)}`}><Waypoints/> Kapcsolati háló</Link>
    </Button>
  );
}
