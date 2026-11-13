type LineId = "traversal" | "paths" | "trees" | "order" | "flow" | "tours";

type AlgoId =
  | "bfs"
  | "dfs"
  | "dijkstra"
  | "bellman-ford"
  | "floyd-warshall"
  | "a-star"
  | "kruskal"
  | "prim"
  | "boruvka"
  | "topological"
  | "tarjan"
  | "kosaraju"
  | "ford-fulkerson"
  | "dinic"
  | "hopcroft-karp"
  | "euler"
  | "hierholzer"
  | "cycle";

interface Vertex {
  x: number;
  y: number;
}

interface Edge {
  u: number;
  v: number;
  w: number;
}

interface Graph {
  vertices: Vertex[];
  edges: Edge[];
}

type VertexState = "source" | "sink" | "active" | "done" | "warn";
type EdgeState = "active" | "chosen" | "rejected" | "dim";

interface StepTable {
  head: string[];
  rows: string[][];
  mark?: number;
  markCell?: [number, number];
}

interface Step {
  text: string;
  vState: Map<number, VertexState>;
  eState: Map<number, EdgeState>;
  vLabel: Map<number, string>;
  eLabel: Map<number, string>;
  table?: StepTable;
  reverse?: boolean;
}

interface StepExtras {
  vState?: Map<number, VertexState>;
  eState?: Map<number, EdgeState>;
  vLabel?: Map<number, string>;
  eLabel?: Map<number, string>;
  table?: StepTable;
  reverse?: boolean;
}

interface Hop {
  to: number;
  edge: number;
}

const MAX_VERTICES = 14;
const MAX_WEIGHT = 99;
const STAGE_W = 1000;
const STAGE_H = 620;

function vertexName(i: number): string {
  return String.fromCharCode(65 + i);
}

function nameList(list: number[], separator = ", "): string {
  return list.map(vertexName).join(separator);
}

function edgeName(e: Edge, directed: boolean): string {
  return vertexName(e.u) + (directed ? "→" : "–") + vertexName(e.v);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatDistance(d: number): string {
  return d === Infinity ? "∞" : String(d);
}

function adjacency(g: Graph, directed: boolean): Hop[][] {
  const out: Hop[][] = g.vertices.map(() => []);
  g.edges.forEach((e, i) => {
    out[e.u].push({ to: e.v, edge: i });
    if (!directed) out[e.v].push({ to: e.u, edge: i });
  });
  return out;
}

class StepRecorder {
  readonly steps: Step[] = [];

  add(text: string, extras: StepExtras = {}): void {
    this.steps.push({
      text,
      vState: new Map(extras.vState ?? []),
      eState: new Map(extras.eState ?? []),
      vLabel: new Map(extras.vLabel ?? []),
      eLabel: new Map(extras.eLabel ?? []),
      table: extras.table,
      reverse: extras.reverse,
    });
  }
}
