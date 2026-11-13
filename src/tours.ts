function hierholzer(g: Graph): Step[] {
  const n = g.vertices.length;
  const m = g.edges.length;
  const rec = new StepRecorder();
  if (m === 0) {
    rec.add("This graph has no edges to walk along. Add some edges first.");
    return rec.steps;
  }

  const adj = adjacency(g, false);
  const degree = adj.map((list) => list.length);
  const degreeLabels = new Map(degree.map((d, i) => [i, `degree ${d}`] as [number, string]));
  const odd = degree.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
  const first = degree.findIndex((d) => d > 0);

  const reached = new Set<number>([first]);
  const pending = [first];
  while (pending.length) {
    adj[pending.pop() as number].forEach(({ to }) => {
      if (!reached.has(to)) {
        reached.add(to);
        pending.push(to);
      }
    });
  }
  if (reached.size !== degree.filter((d) => d > 0).length) {
    rec.add("The edges lie in more than one separate piece, so no single walk can cover them all. No Euler tour exists.", {
      vLabel: degreeLabels,
    });
    return rec.steps;
  }
  if (odd.length !== 0 && odd.length !== 2) {
    rec.add(
      `An Euler tour needs exactly 0 or 2 vertices of odd degree. This graph has ${odd.length} (${nameList(odd)}), so none exists.`,
      { vLabel: degreeLabels, vState: new Map(odd.map((i) => [i, "warn"] as [number, VertexState])) }
    );
    return rec.steps;
  }

  const circuit = odd.length === 0;
  const start = circuit ? first : odd[0];
  const used: boolean[] = new Array(m).fill(false);
  const stack: { v: number; via: number }[] = [{ v: start, via: -1 }];
  const tour: { v: number; via: number }[] = [];
  const next: number[] = new Array(n).fill(0);

  const table = (): StepTable => ({
    head: ["List", "Vertices"],
    rows: [
      ["Stack", stack.length ? nameList(stack.map((s) => s.v), " ") : "empty"],
      ["Finished", tour.length ? nameList(tour.map((s) => s.v), " ") : "empty"],
    ],
  });
  const edges = (fresh = -1): Map<number, EdgeState> => {
    const es = new Map<number, EdgeState>();
    stack.forEach((s) => {
      if (s.via >= 0) es.set(s.via, s.via === fresh ? "active" : "chosen");
    });
    tour.forEach((s) => {
      if (s.via >= 0) es.set(s.via, "dim");
    });
    return es;
  };
  const marks = (): Map<number, VertexState> => new Map([[stack[stack.length - 1].v, "active"] as [number, VertexState]]);

  rec.add(
    (circuit
      ? `Every vertex has even degree, so an Euler circuit exists. Start at ${vertexName(start)}.`
      : `Exactly two vertices have odd degree, ${nameList(odd, " and ")}, so an Euler path runs between them. Start at ${vertexName(start)}.`) +
      " Keep a stack of the current walk and a list of finished vertices.",
    { vState: marks(), vLabel: degreeLabels, table: table() }
  );

  while (stack.length) {
    const top = stack[stack.length - 1];
    while (next[top.v] < adj[top.v].length && used[adj[top.v][next[top.v]].edge]) next[top.v]++;
    if (next[top.v] < adj[top.v].length) {
      const hop = adj[top.v][next[top.v]];
      used[hop.edge] = true;
      stack.push({ v: hop.to, via: hop.edge });
      rec.add(`At ${vertexName(top.v)}: follow the unused edge ${vertexName(top.v)}–${vertexName(hop.to)} and push ${vertexName(hop.to)} on the stack.`, {
        vState: marks(),
        eState: edges(hop.edge),
        table: table(),
      });
    } else {
      tour.push(stack.pop() as { v: number; via: number });
      const below = stack.length ? stack[stack.length - 1].v : -1;
      rec.add(
        `${vertexName(top.v)} has no unused edges left, so move it from the stack to the finished list.` +
          (below >= 0 ? ` Back at ${vertexName(below)}${next[below] < adj[below].length ? ", which may still have a detour to take" : ""}.` : ""),
        { vState: stack.length ? marks() : undefined, eState: edges(), table: table() }
      );
    }
  }

  const order = new Map<number, string>();
  const es = new Map<number, EdgeState>();
  tour.forEach((s, k) => {
    if (s.via >= 0) {
      order.set(s.via, String(m - k));
      es.set(s.via, "chosen");
    }
  });
  const walk = tour.map((s) => s.v).reverse();
  rec.add(
    `Done. Read the finished list backwards to get the Euler ${circuit ? "circuit" : "path"}: ${nameList(walk, " → ")}. The numbers show the order of the ${m} edges.`,
    {
      vState: new Map<number, VertexState>([
        [walk[walk.length - 1], circuit ? "source" : "sink"],
        [walk[0], "source"],
      ]),
      eState: es,
      eLabel: order,
      table: table(),
    }
  );
  return rec.steps;
}

function detectCycle(g: Graph): Step[] {
  const n = g.vertices.length;
  const rec = new StepRecorder();
  const adj = adjacency(g, true);
  const colour: number[] = new Array(n).fill(0);
  const path: number[] = [];
  const pathEdges: number[] = [];

  const marks = (): Map<number, VertexState> => {
    const m = new Map<number, VertexState>();
    colour.forEach((c, i) => {
      if (c === 2) m.set(i, "done");
      else if (c === 1) m.set(i, "active");
    });
    return m;
  };
  const edges = (): Map<number, EdgeState> => new Map(pathEdges.map((e) => [e, "chosen"] as [number, EdgeState]));
  const table = (): StepTable => ({
    head: ["Vertex", "State"],
    rows: colour.map((c, i) => [vertexName(i), ["not visited", "on the current path", "finished"][c]]),
    mark: path.length ? path[path.length - 1] : undefined,
  });

  const visit = (x: number): boolean => {
    colour[x] = 1;
    path.push(x);
    rec.add(`Visit ${vertexName(x)}. Current path: ${nameList(path, " → ")}.`, { vState: marks(), eState: edges(), table: table() });
    for (const { to, edge } of adj[x]) {
      if (colour[to] === 1) {
        const from = path.indexOf(to);
        const loop = path.slice(from);
        const es = edges();
        const vs = marks();
        pathEdges.slice(from).concat(edge).forEach((e) => es.set(e, "rejected"));
        loop.forEach((v) => vs.set(v, "warn"));
        rec.add(
          `${edgeName(g.edges[edge], true)} leads back to ${vertexName(to)}, which is still on the current path. That closes the cycle ${nameList(loop.concat(to), " → ")}, shown dotted.`,
          { vState: vs, eState: es, table: table() }
        );
        return true;
      }
      if (colour[to] === 0) {
        pathEdges.push(edge);
        if (visit(to)) return true;
        pathEdges.pop();
      }
    }
    colour[x] = 2;
    path.pop();
    rec.add(
      `Every edge out of ${vertexName(x)} has been followed without returning to the path, so ${vertexName(x)} is finished.`,
      { vState: marks(), eState: edges(), table: table() }
    );
    return false;
  };

  rec.add("Search depth-first and remember which vertices are on the current path. An edge that points back into the path means a cycle.", {
    table: table(),
  });
  for (let i = 0; i < n; i++) {
    if (colour[i] === 0 && visit(i)) return rec.steps;
  }
  rec.add("Done. No edge ever pointed back into the current path, so the graph has no directed cycle.", {
    vState: marks(),
    table: table(),
  });
  return rec.steps;
}
