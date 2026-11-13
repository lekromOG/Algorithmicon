function refuseNegative(g: Graph, who: string, directed: boolean): Step[] | null {
  const i = g.edges.findIndex((e) => e.w < 0);
  if (i < 0) return null;
  const rec = new StepRecorder();
  rec.add(
    `${who} assumes that a finished distance can never improve later, which only holds when no weight is negative. ${edgeName(g.edges[i], directed)} has weight ${g.edges[i].w}. Use Bellman-Ford for this graph.`,
    { eState: new Map([[i, "rejected"] as [number, EdgeState]]) }
  );
  return rec.steps;
}

function dijkstra(g: Graph, source: number): Step[] {
  const refused = refuseNegative(g, "Dijkstra's algorithm", true);
  if (refused) return refused;

  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, true);
  const dist: number[] = new Array(n).fill(Infinity);
  const pred: number[] = new Array(n).fill(-1);
  const settled: boolean[] = new Array(n).fill(false);
  dist[source] = 0;
  const S = vertexName(source);

  const labels = (): Map<number, string> => new Map(dist.map((d, i) => [i, formatDistance(d)] as [number, string]));
  const table = (mark?: number): StepTable => ({
    head: ["Vertex", "Distance", "Via", "Final"],
    rows: dist.map((d, i) => [
      vertexName(i),
      formatDistance(d),
      i === source ? "start" : pred[i] < 0 ? "—" : vertexName(g.edges[pred[i]].u),
      settled[i] ? "yes" : "",
    ]),
    mark,
  });
  const marks = (current?: number): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    settled.forEach((s, i) => {
      if (s) m.set(i, "done");
    });
    m.set(source, "source");
    if (current !== undefined && current !== source) m.set(current, "active");
    return m;
  };
  const tree = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    pred.forEach((p) => {
      if (p >= 0) m.set(p, "chosen");
    });
    return m;
  };

  rec.add(`Start at ${S} with distance 0. Every other vertex starts at ∞ and nothing is final yet.`, {
    vState: marks(),
    vLabel: labels(),
    table: table(source),
  });

  for (;;) {
    let x = -1;
    for (let i = 0; i < n; i++) {
      if (!settled[i] && dist[i] !== Infinity && (x < 0 || dist[i] < dist[x])) x = i;
    }
    if (x < 0) break;
    settled[x] = true;
    const improved: string[] = [];
    const fresh: number[] = [];
    adj[x].forEach(({ to, edge }) => {
      const candidate = dist[x] + g.edges[edge].w;
      if (!settled[to] && candidate < dist[to]) {
        dist[to] = candidate;
        pred[to] = edge;
        improved.push(`${vertexName(to)} to ${candidate}`);
        fresh.push(edge);
      }
    });
    const es = tree();
    fresh.forEach((e) => es.set(e, "active"));
    rec.add(
      `${vertexName(x)} has the smallest distance not yet final (${dist[x]}), so make it final. ` +
        (improved.length ? `Going on from ${vertexName(x)} improves ${improved.join(", ")}.` : `Going on from ${vertexName(x)} improves nothing.`),
      { vState: marks(x), eState: es, vLabel: labels(), table: table(x) }
    );
  }

  const missed = dist.map((d, i) => (d === Infinity ? i : -1)).filter((i) => i >= 0);
  rec.add(
    `Done. The highlighted edges are the shortest-path tree from ${S}.` +
      (missed.length ? ` ${nameList(missed)} cannot be reached from ${S} and stay at ∞.` : ""),
    { vState: marks(), eState: tree(), vLabel: labels(), table: table() }
  );
  return rec.steps;
}

function aStar(g: Graph, source: number, goal: number): Step[] {
  const refused = refuseNegative(g, "A*", false);
  if (refused) return refused;

  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, false);
  const S = vertexName(source);
  const T = vertexName(goal);
  const target = g.vertices[goal];
  const h = g.vertices.map((v) => Math.round(Math.hypot(v.x - target.x, v.y - target.y) / 10) / 10);
  const cost: number[] = new Array(n).fill(Infinity);
  const pred: number[] = new Array(n).fill(-1);
  const open = new Set<number>([source]);
  const closed = new Set<number>();
  cost[source] = 0;
  const one = (x: number): string => x.toFixed(1);

  const labels = (): Map<number, string> =>
    new Map(h.map((est, i) => [i, cost[i] === Infinity ? `? + ${one(est)}` : `${cost[i]} + ${one(est)}`] as [number, string]));
  const table = (mark?: number): StepTable => ({
    head: ["Vertex", "Cost so far", "Estimate left", "Total"],
    rows: h.map((est, i) => [vertexName(i), formatDistance(cost[i]), one(est), cost[i] === Infinity ? "—" : one(cost[i] + est)]),
    mark,
  });
  const marks = (current?: number): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    closed.forEach((v) => m.set(v, "done"));
    if (current !== undefined) m.set(current, "active");
    m.set(source, "source");
    m.set(goal, "sink");
    return m;
  };
  const tree = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    pred.forEach((p) => {
      if (p >= 0) m.set(p, "chosen");
    });
    return m;
  };

  rec.add(
    `Label every vertex with cost so far + estimate left. The estimate is the straight-line distance to ${T} on the drawing, where 100 units count as 1. Only ${S} is open.`,
    { vState: marks(), vLabel: labels(), table: table(source) }
  );

  while (open.size) {
    let x = -1;
    open.forEach((i) => {
      if (x < 0 || cost[i] + h[i] < cost[x] + h[x] || (cost[i] + h[i] === cost[x] + h[x] && h[i] < h[x])) x = i;
    });

    if (x === goal) {
      const es = new Map<number, EdgeState>();
      const route = [goal];
      for (let v = goal; v !== source; ) {
        es.set(pred[v], "chosen");
        const e = g.edges[pred[v]];
        v = e.u === v ? e.v : e.u;
        route.unshift(v);
      }
      rec.add(
        `${T} now has the lowest total, so its route cannot be beaten: ${nameList(route, " → ")} with cost ${cost[goal]}. A* expanded ${closed.size} of ${n} vertices and never had to look at the rest.`,
        { vState: marks(), eState: es, vLabel: labels(), table: table(goal) }
      );
      return rec.steps;
    }

    open.delete(x);
    closed.add(x);
    const updates: string[] = [];
    const fresh: number[] = [];
    adj[x].forEach(({ to, edge }) => {
      const candidate = cost[x] + g.edges[edge].w;
      if (closed.has(to) || candidate >= cost[to]) return;
      cost[to] = candidate;
      pred[to] = edge;
      open.add(to);
      updates.push(`${vertexName(to)} (${one(candidate + h[to])})`);
      fresh.push(edge);
    });
    const es = tree();
    fresh.forEach((e) => es.set(e, "active"));
    rec.add(
      `Expand ${vertexName(x)}: its total ${cost[x]} + ${one(h[x])} = ${one(cost[x] + h[x])} is the lowest among open vertices. ` +
        (updates.length ? `New totals: ${updates.join(", ")}.` : "None of its neighbours gets a better total."),
      { vState: marks(x), eState: es, vLabel: labels(), table: table(x) }
    );
  }

  rec.add(`No open vertices are left and ${T} was never reached, so there is no route from ${S} to ${T}.`, {
    vState: marks(),
    eState: tree(),
    vLabel: labels(),
    table: table(),
  });
  return rec.steps;
}

function floydWarshall(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const d: number[][] = g.vertices.map((_, i) => g.vertices.map((_, j) => (i === j ? 0 : Infinity)));
  g.edges.forEach((e) => {
    d[e.u][e.v] = Math.min(d[e.u][e.v], e.w);
  });

  const table = (cell?: [number, number]): StepTable => ({
    head: ["From / to", ...g.vertices.map((_, i) => vertexName(i))],
    rows: d.map((row, i) => [vertexName(i), ...row.map(formatDistance)]),
    markCell: cell ? [cell[0], cell[1] + 1] : undefined,
  });
  const num = (x: number): string => (x < 0 ? `(${x})` : String(x));

  rec.add(
    "Fill the table with what is known without any stopover: 0 from a vertex to itself, the weight where an edge exists and ∞ everywhere else.",
    { table: table() }
  );

  for (let k = 0; k < n; k++) {
    let improved = 0;
    const K = vertexName(k);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (d[i][k] === Infinity || d[k][j] === Infinity) continue;
        const candidate = d[i][k] + d[k][j];
        if (candidate >= d[i][j]) continue;
        const before = formatDistance(d[i][j]);
        d[i][j] = candidate;
        improved++;
        rec.add(
          `Allow stopovers at ${K}: ${vertexName(i)} to ${vertexName(j)} drops from ${before} to ${candidate}, because ${vertexName(i)}→${K} costs ${num(d[i][k])} and ${K}→${vertexName(j)} costs ${num(d[k][j])}.`,
          {
            vState: new Map<number, VertexState>([
              [i, "source"],
              [j, "sink"],
              [k, "active"],
            ]),
            table: table([i, j]),
          }
        );
      }
    }
    if (!improved) {
      rec.add(`Allow stopovers at ${K}: no route gets shorter.`, {
        vState: new Map([[k, "active"] as [number, VertexState]]),
        table: table(),
      });
    }
  }

  const bad = d.findIndex((row, i) => row[i] < 0);
  if (bad >= 0) {
    rec.add(
      `${vertexName(bad)} can reach itself with a negative total (${d[bad][bad]}). That is a negative cycle, so the costs through it are not meaningful.`,
      { vState: new Map([[bad, "warn"] as [number, VertexState]]), table: table([bad, bad]) }
    );
  } else {
    rec.add("Done. Every vertex has been allowed as a stopover, so each cell holds the cheapest cost from its row to its column.", {
      table: table(),
    });
  }
  return rec.steps;
}
