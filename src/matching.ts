function dinic(g: Graph, source: number, sink: number): Step[] {
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
  const moves: { i: number; dir: number; to: number }[][] = g.vertices.map(() => []);
  g.edges.forEach((e, i) => {
    if (cap[i] === 0) return;
    moves[e.u].push({ i, dir: 1, to: e.v });
    moves[e.v].push({ i, dir: -1, to: e.u });
  });
  const room = (m: { i: number; dir: number }): number => (m.dir > 0 ? cap[m.i] - flow[m.i] : flow[m.i]);

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

  rec.add(`Send as much as possible from ${S} to ${T}. Every edge starts with a flow of 0, shown as flow/capacity.`, {
    vState: ends(),
    eState: base(),
    eLabel: labels(),
    table: table(),
  });

  let total = 0;
  for (let phase = 1; ; phase++) {
    const level: number[] = new Array(n).fill(-1);
    level[source] = 0;
    const queue = [source];
    while (queue.length) {
      const x = queue.shift() as number;
      moves[x].forEach((m) => {
        if (level[m.to] < 0 && room(m) > 0) {
          level[m.to] = level[x] + 1;
          queue.push(m.to);
        }
      });
    }
    const levelLabels = new Map(level.map((l, i) => [i, l < 0 ? "" : `level ${l}`] as [number, string]).filter(([, t]) => t));

    if (level[sink] < 0) {
      const cut = base();
      let cutCap = 0;
      g.edges.forEach((e, i) => {
        if (cap[i] > 0 && level[e.u] >= 0 && level[e.v] < 0) {
          cut.set(i, "rejected");
          cutCap += cap[i];
        }
      });
      const vs = ends();
      level.forEach((l, i) => {
        if (l >= 0 && i !== source) vs.set(i, "done");
      });
      rec.add(
        `Phase ${phase}: the search from ${S} no longer reaches ${T}, so the maximum flow is ${total}. ` +
          (total > 0
            ? `The dotted edges are full and separate what ${S} can still reach from the rest. They form a minimum cut with the same capacity, ${cutCap}.`
            : `${T} cannot be reached from ${S} at all.`),
        { vState: vs, eState: cut, eLabel: labels(), table: table() }
      );
      return rec.steps;
    }

    const layered = base();
    g.edges.forEach((e, i) => {
      const forward = level[e.u] >= 0 && level[e.v] === level[e.u] + 1 && flow[i] < cap[i];
      const backward = level[e.v] >= 0 && level[e.u] === level[e.v] + 1 && flow[i] > 0;
      if (cap[i] > 0 && (forward || backward)) layered.set(i, "active");
    });
    rec.add(
      `Phase ${phase}: a breadth-first search gives every vertex its level, the number of usable edges from ${S}. Only moves that go exactly one level deeper are allowed in this phase.`,
      { vState: ends(), eState: layered, vLabel: levelLabels, eLabel: labels(), table: table() }
    );

    const next: number[] = new Array(n).fill(0);
    const hops: { i: number; dir: number }[] = [];
    const push = (x: number, limit: number): number => {
      if (x === sink) return limit;
      for (; next[x] < moves[x].length; next[x]++) {
        const m = moves[x][next[x]];
        if (level[m.to] !== level[x] + 1 || room(m) <= 0) continue;
        const sent = push(m.to, Math.min(limit, room(m)));
        if (sent > 0) {
          flow[m.i] += m.dir * sent;
          hops.unshift({ i: m.i, dir: m.dir });
          return sent;
        }
      }
      return 0;
    };

    for (;;) {
      hops.length = 0;
      const sent = push(source, Infinity);
      if (sent === 0) break;
      total += sent;
      const route = [source];
      hops.forEach((h) => route.push(h.dir > 0 ? g.edges[h.i].v : g.edges[h.i].u));
      const es = base();
      hops.forEach((h) => es.set(h.i, "active"));
      rec.add(`Phase ${phase}: push ${sent} along ${nameList(route, " → ")}. Total flow is now ${total}.`, {
        vState: ends(),
        eState: es,
        vLabel: levelLabels,
        eLabel: labels(),
        table: table(),
      });
    }
  }
}

function hopcroftKarp(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, false);

  const side: number[] = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (side[s] >= 0) continue;
    side[s] = 0;
    const queue = [s];
    while (queue.length) {
      const x = queue.shift() as number;
      for (const { to, edge } of adj[x]) {
        if (side[to] < 0) {
          side[to] = 1 - side[x];
          queue.push(to);
        } else if (side[to] === side[x]) {
          rec.add(
            `Matching needs two sides with every edge crossing between them. ${edgeName(g.edges[edge], false)} joins two vertices that must be on the same side, so this graph is not bipartite.`,
            {
              eState: new Map([[edge, "rejected"] as [number, EdgeState]]),
              vState: new Map<number, VertexState>([
                [x, "warn"],
                [to, "warn"],
              ]),
            }
          );
          return rec.steps;
        }
      }
    }
  }

  const left = side.map((s, i) => (s === 0 ? i : -1)).filter((i) => i >= 0);
  const right = side.map((s, i) => (s === 1 ? i : -1)).filter((i) => i >= 0);
  const pair: number[] = new Array(n).fill(-1);
  const edgeBetween = (a: number, b: number): number => (adj[a].find((h) => h.to === b) as Hop).edge;
  const size = (): number => left.filter((u) => pair[u] >= 0).length;

  const marks = (): Map<number, VertexState> =>
    new Map(pair.map((p, i) => [i, "done"] as [number, VertexState]).filter(([i]) => pair[i] >= 0));
  const sideLabels = new Map(side.map((s, i) => [i, s === 0 ? "left" : "right"] as [number, string]));
  const matching = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    left.forEach((u) => {
      if (pair[u] >= 0) m.set(edgeBetween(u, pair[u]), "chosen");
    });
    return m;
  };
  const table = (): StepTable => ({
    head: ["Left vertex", "Matched with"],
    rows: left.map((u) => [vertexName(u), pair[u] >= 0 ? vertexName(pair[u]) : "—"]),
  });

  rec.add(
    `Split the vertices into two sides so that every edge crosses: left {${nameList(left)}}, right {${nameList(right)}}. Nothing is matched yet.`,
    { vLabel: sideLabels, table: table() }
  );

  for (let phase = 1; ; phase++) {
    const dist: number[] = new Array(n).fill(Infinity);
    const queue: number[] = [];
    left.forEach((u) => {
      if (pair[u] < 0) {
        dist[u] = 0;
        queue.push(u);
      }
    });
    let reachable = false;
    while (queue.length) {
      const u = queue.shift() as number;
      adj[u].forEach(({ to }) => {
        const w = pair[to];
        if (w < 0) reachable = true;
        else if (dist[w] === Infinity) {
          dist[w] = dist[u] + 1;
          queue.push(w);
        }
      });
    }
    if (!reachable) break;

    const search = (u: number): number[] | null => {
      for (const { to } of adj[u]) {
        const w = pair[to];
        if (w < 0) return [u, to];
        if (dist[w] === dist[u] + 1) {
          const rest = search(w);
          if (rest) return [u, to, ...rest];
        }
      }
      dist[u] = Infinity;
      return null;
    };

    for (const u of left) {
      if (pair[u] >= 0) continue;
      const path = search(u);
      if (!path) continue;
      const pathEdges = path.slice(1).map((v, k) => edgeBetween(path[k], v));

      if (path.length > 2) {
        const es = matching();
        pathEdges.forEach((e) => es.set(e, es.get(e) === "chosen" ? "rejected" : "active"));
        rec.add(
          `Phase ${phase}: ${nameList(path, " – ")} is an augmenting path. It starts and ends at unmatched vertices and its edges alternate between unmatched and matched (dotted).`,
          { vState: marks(), eState: es, table: table() }
        );
      }
      for (let k = 0; k < path.length; k += 2) {
        pair[path[k]] = path[k + 1];
        pair[path[k + 1]] = path[k];
      }
      const es = matching();
      pathEdges.forEach((e) => {
        if (es.get(e) === "chosen") es.set(e, "active");
      });
      rec.add(
        (path.length > 2
          ? `Swap the roles along that path: matched edges are dropped and the others are matched instead.`
          : `Phase ${phase}: ${vertexName(path[0])} and ${vertexName(path[1])} are both unmatched, so match them directly.`) +
          ` The matching now has ${size()} pair${size() > 1 ? "s" : ""}.`,
        { vState: marks(), eState: es, table: table() }
      );
    }
  }

  const free = left.concat(right).filter((v) => pair[v] < 0 && adj[v].length > 0);
  rec.add(
    `Done. No augmenting path is left, so the matching of ${size()} pair${size() === 1 ? "" : "s"} is as large as possible.` +
      (free.length ? ` ${nameList(free)} ${free.length > 1 ? "stay" : "stays"} unmatched.` : " Every vertex is matched."),
    { vState: marks(), eState: matching(), vLabel: sideLabels, table: table() }
  );
  return rec.steps;
}
