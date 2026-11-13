"use strict";
function kruskal(g) {
    const n = g.vertices.length;
    const rec = new StepRecorder();
    const order = g.edges.map((_, i) => i).sort((a, b) => g.edges[a].w - g.edges[b].w || a - b);
    const decision = order.map(() => "");
    const state = new Map();
    const root = g.vertices.map((_, i) => i);
    const find = (x) => {
        while (root[x] !== x) {
            root[x] = root[root[x]];
            x = root[x];
        }
        return x;
    };
    const table = (mark) => ({
        head: ["Edge", "Weight", "Decision"],
        rows: order.map((ei, pos) => [edgeName(g.edges[ei], false), String(g.edges[ei].w), decision[pos]]),
        mark,
    });
    if (order.length === 0) {
        rec.add("This graph has no edges, so there is nothing to connect. Add some edges first.");
        return rec.steps;
    }
    rec.add(`Sort all ${order.length} edges by weight, lightest first. Every vertex starts as its own component.`, { table: table() });
    let total = 0;
    let taken = 0;
    for (let pos = 0; pos < order.length; pos++) {
        const ei = order[pos];
        const e = g.edges[ei];
        if (taken === n - 1) {
            decision[pos] = "not needed";
            state.set(ei, "dim");
            continue;
        }
        const a = find(e.u);
        const b = find(e.v);
        const name = `${edgeName(e, false)} (weight ${e.w})`;
        if (a !== b) {
            root[a] = b;
            taken++;
            total += e.w;
            decision[pos] = "added";
            const es = new Map(state);
            es.set(ei, "active");
            state.set(ei, "chosen");
            rec.add(`${name} joins two separate components. Add it to the tree. Total weight so far: ${total}.`, {
                eState: es,
                table: table(pos),
            });
        }
        else {
            decision[pos] = "skipped";
            const es = new Map(state);
            es.set(ei, "rejected");
            state.set(ei, "dim");
            rec.add(`${name} would close a cycle, because ${vertexName(e.u)} and ${vertexName(e.v)} are already connected. Skip it.`, { eState: es, table: table(pos) });
        }
    }
    const vs = new Map(g.vertices.map((_, i) => [i, "done"]));
    if (taken === n - 1) {
        rec.add(`Done. The minimum spanning tree connects all ${n} vertices with ${taken} edges and a total weight of ${total}.`, { vState: vs, eState: state, table: table() });
    }
    else {
        rec.add(`Done. The graph is not connected, so the result is a minimum spanning forest of ${n - taken} trees with a total weight of ${total}.`, { eState: state, table: table() });
    }
    return rec.steps;
}
