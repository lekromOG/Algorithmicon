function topologicalSort(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, true);
  const incoming: number[] = new Array(n).fill(0);
  g.edges.forEach((e) => incoming[e.v]++);
  const order: number[] = [];
  const removed = new Set<number>();

  const labels = (): Map<number, string> =>
    new Map(incoming.map((d, i) => [i, order.includes(i) ? `no. ${order.indexOf(i) + 1}` : `${d} in`] as [number, string]));
  const marks = (current = -1): Map<number, VertexState> =>
    new Map(order.map((v) => [v, v === current ? "active" : "done"] as [number, VertexState]));
  const edges = (fresh: number[] = []): Map<number, EdgeState> => {
    const m = new Map<number, EdgeState>();
    removed.forEach((e) => m.set(e, fresh.includes(e) ? "active" : "dim"));
    return m;
  };
  const table = (): StepTable => ({
    head: ["Position", "Vertex"],
    rows: order.map((v, i) => [String(i + 1), vertexName(v)]),
    mark: order.length - 1,
  });
  const ready = (): number[] => incoming.map((d, i) => (d === 0 && !order.includes(i) ? i : -1)).filter((i) => i >= 0);

  rec.add(
    `Count the incoming edges of every vertex. ${ready().length ? `${nameList(ready())} ${ready().length > 1 ? "have" : "has"} none, so nothing has to come before ${ready().length > 1 ? "them" : "it"}.` : "Every vertex has at least one."}`,
    { vLabel: labels() }
  );

  while (ready().length) {
    const x = ready()[0];
    order.push(x);
    const freed: number[] = [];
    const fresh: number[] = [];
    adj[x].forEach(({ to, edge }) => {
      removed.add(edge);
      fresh.push(edge);
      if (--incoming[to] === 0) freed.push(to);
    });
    rec.add(
      `Place ${vertexName(x)} at position ${order.length} and remove its outgoing edges. ` +
        (freed.length ? `${nameList(freed)} now ${freed.length > 1 ? "have" : "has"} no incoming edges and can be placed.` : "No new vertex is freed."),
      { vState: marks(x), eState: edges(fresh), vLabel: labels(), table: table() }
    );
  }

  if (order.length === n) {
    rec.add(`Done. One valid order is ${nameList(order)}. Every edge points from an earlier vertex to a later one.`, {
      vState: marks(),
      eState: new Map(),
      vLabel: labels(),
      table: { head: ["Position", "Vertex"], rows: order.map((v, i) => [String(i + 1), vertexName(v)]) },
    });
  } else {
    const stuck = g.vertices.map((_, i) => i).filter((i) => !order.includes(i));
    const vs = marks();
    stuck.forEach((v) => vs.set(v, "warn"));
    rec.add(
      `${nameList(stuck)} ${stuck.length > 1 ? "are" : "is"} left, but each still waits for another. They lie on or behind a cycle, so no topological order exists.`,
      { vState: vs, eState: edges(), vLabel: labels(), table: table() }
    );
  }
  return rec.steps;
}

function componentView(g: Graph, component: number[]) {
  return {
    edges: (): Map<number, EdgeState> => {
      const m = new Map<number, EdgeState>();
      g.edges.forEach((e, i) => {
        if (component[e.u] >= 0 && component[e.u] === component[e.v]) m.set(i, "chosen");
      });
      return m;
    },
    table: (count: number): StepTable => ({
      head: ["Component", "Vertices"],
      rows: Array.from({ length: count }, (_, c) => [
        String(c + 1),
        nameList(component.map((x, i) => (x === c ? i : -1)).filter((i) => i >= 0)),
      ]),
      mark: count - 1,
    }),
  };
}

function tarjan(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, true);
  const index: number[] = new Array(n).fill(-1);
  const low: number[] = new Array(n).fill(-1);
  const component: number[] = new Array(n).fill(-1);
  const stack: number[] = [];
  const view = componentView(g, component);
  let counter = 0;
  let count = 0;

  const labels = (): Map<number, string> =>
    new Map(
      index
        .map((ix, i) => [i, component[i] >= 0 ? `group ${component[i] + 1}` : ix < 0 ? "" : `${ix} / ${low[i]}`] as [number, string])
        .filter(([, t]) => t)
    );
  const marks = (): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    component.forEach((c, i) => {
      if (c >= 0) m.set(i, "done");
    });
    stack.forEach((v) => m.set(v, "active"));
    return m;
  };
  const snapshot = (active = -1) => {
    const es = view.edges();
    if (active >= 0) es.set(active, "active");
    return { vState: marks(), eState: es, vLabel: labels(), table: view.table(count) };
  };
  const stackText = (): string => `Stack: ${stack.length ? nameList(stack) : "empty"}.`;

  const visit = (x: number, via: number): void => {
    index[x] = low[x] = counter++;
    stack.push(x);
    rec.add(`Visit ${vertexName(x)}: number ${index[x]}, lowest reachable ${low[x]}. Push it on the stack. ${stackText()}`, snapshot(via));
    adj[x].forEach(({ to, edge }) => {
      if (index[to] < 0) {
        visit(to, edge);
        low[x] = Math.min(low[x], low[to]);
      } else if (component[to] < 0 && index[to] < low[x]) {
        low[x] = index[to];
        rec.add(
          `${edgeName(g.edges[edge], true)} leads back to ${vertexName(to)}, which is still on the stack. So ${vertexName(x)} can reach number ${index[to]}: lower its second label.`,
          snapshot(edge)
        );
      }
    });
    if (low[x] === index[x]) {
      const group: number[] = [];
      let y: number;
      do {
        y = stack.pop() as number;
        component[y] = count;
        group.unshift(y);
      } while (y !== x);
      count++;
      rec.add(
        `${vertexName(x)} cannot reach anything numbered lower than itself, so it is the root of a component. Pop the stack down to ${vertexName(x)}: {${nameList(group)}}. ${stackText()}`,
        snapshot()
      );
    }
  };

  rec.add("Explore depth-first. Each vertex gets two labels: its visit number, and the lowest number it can reach through vertices still on the stack.");
  for (let i = 0; i < n; i++) {
    if (index[i] < 0) visit(i, -1);
  }
  const final = snapshot();
  final.table.mark = undefined;
  rec.add(
    `Done. The graph has ${count} strongly connected component${count > 1 ? "s" : ""}. Inside a component every vertex can reach every other.`,
    final
  );
  return rec.steps;
}

function kosaraju(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const forward = adjacency(g, true);
  const backward: Hop[][] = g.vertices.map(() => []);
  g.edges.forEach((e, i) => backward[e.v].push({ to: e.u, edge: i }));
  const seen: boolean[] = new Array(n).fill(false);
  const finishOrder: number[] = [];
  const component: number[] = new Array(n).fill(-1);
  const view = componentView(g, component);
  let count = 0;

  const first = (x: number): void => {
    seen[x] = true;
    forward[x].forEach(({ to }) => {
      if (!seen[to]) first(to);
    });
    finishOrder.push(x);
    rec.add(`Pass 1: ${vertexName(x)} is finished. Finish order so far: ${nameList(finishOrder)}.`, {
      vState: new Map(finishOrder.map((v) => [v, v === x ? "active" : "done"] as [number, VertexState])),
      vLabel: new Map(finishOrder.map((v, i) => [v, `finished ${i + 1}`] as [number, string])),
    });
  };

  rec.add("Pass 1: run a depth-first search over the whole graph and note the order in which vertices finish.");
  for (let i = 0; i < n; i++) {
    if (!seen[i]) first(i);
  }

  const labels = (): Map<number, string> =>
    new Map(component.map((c, i) => [i, c >= 0 ? `group ${c + 1}` : `finished ${finishOrder.indexOf(i) + 1}`] as [number, string]));
  const marks = (fresh: number[] = []): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    component.forEach((c, i) => {
      if (c >= 0) m.set(i, fresh.includes(i) ? "active" : "done");
    });
    return m;
  };

  rec.add(
    "Pass 2: turn every edge around. Now search again, always starting from the unassigned vertex that finished last.",
    { vLabel: labels(), reverse: true }
  );

  for (let k = n - 1; k >= 0; k--) {
    const start = finishOrder[k];
    if (component[start] >= 0) continue;
    const group: number[] = [];
    const collect = (x: number): void => {
      component[x] = count;
      group.push(x);
      backward[x].forEach(({ to }) => {
        if (component[to] < 0) collect(to);
      });
    };
    collect(start);
    count++;
    group.sort((a, b) => a - b);
    rec.add(
      `Pass 2: from ${vertexName(start)}, the reversed edges reach ${group.length > 1 ? `{${nameList(group)}}` : "nothing new"} without entering an earlier group. ${group.length > 1 ? "That is" : `${vertexName(start)} alone is`} one strongly connected component.`,
      { vState: marks(group), eState: view.edges(), vLabel: labels(), table: view.table(count), reverse: true }
    );
  }

  const table = view.table(count);
  table.mark = undefined;
  rec.add(
    `Done. Turn the edges back: the graph has ${count} strongly connected component${count > 1 ? "s" : ""}. Inside a component every vertex can reach every other.`,
    { vState: marks(), eState: view.edges(), vLabel: labels(), table }
  );
  return rec.steps;
}
