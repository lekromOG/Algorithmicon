function fordFulkerson(g: Graph, source: number, sink: number): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const S = vertexName(source);
  const T = vertexName(sink);

  if (source === sink) {
    rec.add("The source and the sink are the same vertex. Pick two different vertices.");
    return rec.steps;
  }

  const cap = g.edges.map((e) => Math.max(0, e.w));
  const flow: number[] = g.edges.map(() => 0);
  const ignored = cap.filter((c) => c === 0).length;

  const labels = (): Map<number, string> =>
    new Map(g.edges.map((_, i) => [i, cap[i] > 0 ? `${flow[i]}/${cap[i]}` : "–"] as [number, string]));
  const ends = (): Map<number, VertexState> =>
    new Map<number, VertexState>([
      [source, "source"],
      [sink, "sink"],
    ]);
  const base = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    g.edges.forEach((_, i) => {
      if (cap[i] === 0) m.set(i, "dim");
      else if (flow[i] > 0) m.set(i, "chosen");
    });
    return m;
  };
  const table = (): StepTable => ({
    head: ["Edge", "Flow", "Capacity"],
    rows: g.edges.map((e, i) => [edgeName(e, true), String(flow[i]), cap[i] > 0 ? String(cap[i]) : "ignored"]),
  });

  rec.add(
    `Send as much as possible from ${S} to ${T}. Every edge starts with a flow of 0, shown as flow/capacity.` +
      (ignored ? ` ${ignored} edge${ignored > 1 ? "s have" : " has"} no positive capacity and ${ignored > 1 ? "are" : "is"} ignored.` : ""),
    { vState: ends(), eState: base(), eLabel: labels(), table: table() }
  );

  const search = () => {
    const seen: boolean[] = new Array(n).fill(false);
    const viaEdge: number[] = new Array(n).fill(-1);
    const viaDir: number[] = new Array(n).fill(0);
    const queue = [source];
    seen[source] = true;
    while (queue.length) {
      const x = queue.shift() as number;
      g.edges.forEach((e, i) => {
        if (cap[i] === 0) return;
        if (e.u === x && !seen[e.v] && flow[i] < cap[i]) {
          seen[e.v] = true;
          viaEdge[e.v] = i;
          viaDir[e.v] = 1;
          queue.push(e.v);
        } else if (e.v === x && !seen[e.u] && flow[i] > 0) {
          seen[e.u] = true;
          viaEdge[e.u] = i;
          viaDir[e.u] = -1;
          queue.push(e.u);
        }
      });
    }
    return { seen, viaEdge, viaDir };
  };

  let total = 0;
  for (;;) {
    const { seen, viaEdge, viaDir } = search();
    if (!seen[sink]) {
      const cut = base();
      let cutCap = 0;
      g.edges.forEach((e, i) => {
        if (cap[i] > 0 && seen[e.u] && !seen[e.v]) {
          cut.set(i, "rejected");
          cutCap += cap[i];
        }
      });
      const vs = ends();
      seen.forEach((r, i) => {
        if (r && i !== source) vs.set(i, "done");
      });
      rec.add(
        `No augmenting path is left, so the maximum flow from ${S} to ${T} is ${total}. ` +
          (total > 0
            ? `The dotted edges are full and separate what ${S} can still reach from the rest. They form a minimum cut with the same capacity, ${cutCap}.`
            : `${T} cannot be reached from ${S} at all.`),
        { vState: vs, eState: cut, eLabel: labels(), table: table() }
      );
      return rec.steps;
    }

    const hops: { i: number; dir: number }[] = [];
    const names = [T];
    let bottleneck = Infinity;
    for (let x = sink; x !== source; ) {
      const i = viaEdge[x];
      const dir = viaDir[x];
      hops.unshift({ i, dir });
      bottleneck = Math.min(bottleneck, dir > 0 ? cap[i] - flow[i] : flow[i]);
      x = dir > 0 ? g.edges[i].u : g.edges[i].v;
      names.unshift(vertexName(x));
    }

    const found = base();
    hops.forEach((h) => found.set(h.i, "active"));
    rec.add(
      `Breadth-first search finds the augmenting path ${names.join(" → ")}. Its tightest edge leaves room for ${bottleneck}.`,
      { vState: ends(), eState: found, eLabel: labels(), table: table() }
    );

    const backwards: string[] = [];
    hops.forEach((h) => {
      flow[h.i] += h.dir * bottleneck;
      if (h.dir < 0) backwards.push(edgeName(g.edges[h.i], true));
    });
    total += bottleneck;

    const pushed = base();
    hops.forEach((h) => pushed.set(h.i, "active"));
    rec.add(
      `Push ${bottleneck} along that path. Total flow is now ${total}.` +
        (backwards.length
          ? ` ${backwards.join(" and ")} ${backwards.length > 1 ? "are" : "is"} crossed backwards, which cancels ${bottleneck} of the flow sent earlier.`
          : ""),
      { vState: ends(), eState: pushed, eLabel: labels(), table: table() }
    );
  }
}
