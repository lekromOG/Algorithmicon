function bellmanFord(g: Graph, source: number): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const dist: number[] = new Array(n).fill(Infinity);
  const pred: number[] = new Array(n).fill(-1);
  dist[source] = 0;

  const fmt = (d: number): string => (d === Infinity ? "∞" : String(d));
  const labels = (): Map<number, string> => new Map(dist.map((d, i) => [i, fmt(d)] as [number, string]));
  const table = (mark?: number): StepTable => ({
    head: ["Vertex", "Distance", "Reached via"],
    rows: dist.map((d, i) => [
      vertexName(i),
      fmt(d),
      i === source ? "start" : pred[i] < 0 ? "—" : vertexName(g.edges[pred[i]].u),
    ]),
    mark,
  });
  const tree = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    pred.forEach((p) => {
      if (p >= 0) m.set(p, "chosen");
    });
    return m;
  };
  const marks = (active?: number): Map<number, VertexState> => {
    const m = new Map<number, VertexState>([[source, "source"]]);
    if (active !== undefined && active !== source) m.set(active, "active");
    return m;
  };

  const S = vertexName(source);
  rec.add(`Start at ${S}. Its distance is 0 and every other vertex starts at ∞.`, {
    vState: marks(),
    vLabel: labels(),
    table: table(source),
  });

  let settled = false;
  for (let pass = 1; pass <= n - 1 && !settled; pass++) {
    let changed = false;
    g.edges.forEach((e, i) => {
      if (dist[e.u] === Infinity) return;
      const candidate = dist[e.u] + e.w;
      const sum = `${dist[e.u]} + ${e.w < 0 ? `(${e.w})` : e.w} = ${candidate}`;
      if (candidate < dist[e.v]) {
        const before = fmt(dist[e.v]);
        dist[e.v] = candidate;
        pred[e.v] = i;
        changed = true;
        const es = tree();
        es.set(i, "active");
        rec.add(
          `Pass ${pass}: relax ${edgeName(e, true)}. ${sum} beats ${before}, so ${vertexName(e.v)} is now ${candidate} via ${vertexName(e.u)}.`,
          { vState: marks(e.v), eState: es, vLabel: labels(), table: table(e.v) }
        );
      } else {
        const es = tree();
        if (es.get(i) !== "chosen") es.set(i, "rejected");
        rec.add(
          `Pass ${pass}: relax ${edgeName(e, true)}. ${sum} does not beat ${fmt(dist[e.v])}. No change.`,
          { vState: marks(), eState: es, vLabel: labels(), table: table(e.v) }
        );
      }
    });
    if (!changed) {
      settled = true;
      rec.add(`Pass ${pass} changed nothing, so the distances cannot improve any further.`, {
        vState: marks(),
        eState: tree(),
        vLabel: labels(),
        table: table(),
      });
    }
  }

  if (!settled) {
    const bad = g.edges.findIndex((e) => dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]);
    if (bad >= 0) {
      const e = g.edges[bad];
      pred[e.v] = bad;
      let x = e.v;
      for (let k = 0; k < n; k++) x = g.edges[pred[x]].u;
      const es = new Map<number, EdgeState>();
      const vs = marks();
      let y = x;
      do {
        es.set(pred[y], "rejected");
        vs.set(y, "warn");
        y = g.edges[pred[y]].u;
      } while (y !== x);
      rec.add(
        `After ${n - 1} passes ${edgeName(e, true)} can still be relaxed. The dotted edges form a negative cycle reachable from ${S}, so going round it keeps lowering the cost and no shortest path exists.`,
        { vState: vs, eState: es, vLabel: labels(), table: table() }
      );
      return rec.steps;
    }
  }

  const unreachable = dist.map((d, i) => (d === Infinity ? vertexName(i) : "")).filter(Boolean);
  const vs = marks();
  dist.forEach((d, i) => {
    if (i !== source && d !== Infinity) vs.set(i, "done");
  });
  rec.add(
    `Done. The highlighted edges are the shortest-path tree from ${S}.` +
      (unreachable.length ? ` ${unreachable.join(", ")} cannot be reached from ${S} and stay at ∞.` : ""),
    { vState: vs, eState: tree(), vLabel: labels(), table: table() }
  );
  return rec.steps;
}
