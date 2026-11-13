function breadthFirstSearch(g: Graph, source: number): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, false);
  const level: number[] = new Array(n).fill(-1);
  const parent: number[] = new Array(n).fill(-1);
  const via: number[] = new Array(n).fill(-1);
  const processed = new Set<number>();
  const queue = [source];
  level[source] = 0;
  const S = vertexName(source);

  const labels = (): Map<number, string> =>
    new Map(level.map((l, i) => [i, l < 0 ? "" : `level ${l}`] as [number, string]).filter(([, t]) => t));
  const table = (mark?: number): StepTable => ({
    head: ["Vertex", "Level", "Found from"],
    rows: level.map((l, i) => [vertexName(i), l < 0 ? "—" : String(l), i === source ? "start" : parent[i] < 0 ? "—" : vertexName(parent[i])]),
    mark,
  });
  const marks = (current?: number): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    processed.forEach((v) => m.set(v, "done"));
    m.set(source, "source");
    if (current !== undefined && current !== source) m.set(current, "active");
    return m;
  };
  const tree = (): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    via.forEach((e) => {
      if (e >= 0) m.set(e, "chosen");
    });
    return m;
  };

  rec.add(`Start at ${S}. It is level 0 and the only vertex in the queue.`, { vState: marks(), vLabel: labels(), table: table(source) });

  while (queue.length) {
    const x = queue.shift() as number;
    const es = tree();
    const found: number[] = [];
    adj[x].forEach(({ to, edge }) => {
      if (level[to] >= 0) return;
      level[to] = level[x] + 1;
      parent[to] = x;
      via[to] = edge;
      queue.push(to);
      found.push(to);
      es.set(edge, "active");
    });
    processed.add(x);
    rec.add(
      `Take ${vertexName(x)} from the front of the queue. ` +
        (found.length
          ? `${nameList(found)} ${found.length > 1 ? "are" : "is"} new, so ${found.length > 1 ? "they join" : "it joins"} the back of the queue at level ${level[x] + 1}.`
          : "All of its neighbours have been seen already.") +
        ` Queue: ${queue.length ? nameList(queue) : "empty"}.`,
      { vState: marks(x), eState: es, vLabel: labels(), table: table(x) }
    );
  }

  const missed = level.map((l, i) => (l < 0 ? i : -1)).filter((i) => i >= 0);
  rec.add(
    `Done. The queue is empty. The highlighted tree gives a route with the fewest edges from ${S} to every vertex it reached.` +
      (missed.length ? ` ${nameList(missed)} cannot be reached from ${S}.` : ""),
    { vState: marks(), eState: tree(), vLabel: labels(), table: table() }
  );
  return rec.steps;
}

function depthFirstSearch(g: Graph, source: number): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, false);
  const found: number[] = new Array(n).fill(0);
  const finished: number[] = new Array(n).fill(0);
  const via: number[] = new Array(n).fill(-1);
  const path: number[] = [];
  let clock = 0;
  const S = vertexName(source);

  const labels = (): Map<number, string> =>
    new Map(found.map((d, i) => [i, d ? `${d}/${finished[i] || "…"}` : ""] as [number, string]).filter(([, t]) => t));
  const table = (mark?: number): StepTable => ({
    head: ["Vertex", "Discovered", "Finished"],
    rows: found.map((d, i) => [vertexName(i), d ? String(d) : "—", finished[i] ? String(finished[i]) : "—"]),
    mark,
  });
  const marks = (): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    finished.forEach((f, i) => {
      if (f) m.set(i, "done");
    });
    path.forEach((v) => m.set(v, "active"));
    m.set(source, "source");
    return m;
  };
  const tree = (fresh = -1): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    via.forEach((e) => {
      if (e >= 0) m.set(e, e === fresh ? "active" : "chosen");
    });
    return m;
  };

  const visit = (x: number, from: number): void => {
    found[x] = ++clock;
    path.push(x);
    rec.add(
      (from < 0 ? `Start at ${S}.` : `From ${vertexName(from)}, go deeper to ${vertexName(x)}.`) +
        ` Current path: ${nameList(path, " → ")}.`,
      { vState: marks(), eState: tree(via[x]), vLabel: labels(), table: table(x) }
    );
    adj[x].forEach(({ to, edge }) => {
      if (found[to]) return;
      via[to] = edge;
      visit(to, x);
    });
    finished[x] = ++clock;
    path.pop();
    rec.add(
      `${vertexName(x)} has no unvisited neighbours left, so it is finished.` +
        (path.length ? ` Backtrack to ${vertexName(path[path.length - 1])}.` : ""),
      { vState: marks(), eState: tree(), vLabel: labels(), table: table(x) }
    );
  };
  visit(source, -1);

  const missed = found.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
  rec.add(
    `Done. Depth-first search went as far as it could before backtracking. The labels show when each vertex was discovered and finished.` +
      (missed.length ? ` ${nameList(missed)} cannot be reached from ${S}.` : ""),
    { vState: marks(), eState: tree(), vLabel: labels(), table: table() }
  );
  return rec.steps;
}
