"use strict";
function prim(g, source) {
    const n = g.vertices.length;
    const rec = new StepRecorder();
    const inTree = new Array(n).fill(false);
    const chosen = [];
    const rows = [];
    let total = 0;
    inTree[source] = true;
    const S = vertexName(source);
    const marks = (fresh = -1) => {
        const m = new Map();
        inTree.forEach((t, i) => {
            if (t)
                m.set(i, i === fresh ? "active" : "done");
        });
        m.set(source, "source");
        return m;
    };
    const edges = (fresh = -1) => {
        const m = new Map();
        g.edges.forEach((e, i) => {
            if (chosen.includes(i))
                m.set(i, i === fresh ? "active" : "chosen");
            else if (inTree[e.u] && inTree[e.v])
                m.set(i, "dim");
        });
        return m;
    };
    const table = () => ({ head: ["Edge added", "Weight", "Total"], rows: rows.slice(), mark: rows.length - 1 });
    rec.add(`Start the tree with ${S} alone. Grow it one edge at a time, always by the cheapest edge that leaves the tree.`, {
        vState: marks(),
    });
    while (chosen.length < n - 1) {
        let best = -1;
        g.edges.forEach((e, i) => {
            if (inTree[e.u] !== inTree[e.v] && (best < 0 || e.w < g.edges[best].w))
                best = i;
        });
        if (best < 0)
            break;
        const e = g.edges[best];
        const added = inTree[e.u] ? e.v : e.u;
        const crossing = g.edges.filter((x) => inTree[x.u] !== inTree[x.v]).length;
        inTree[added] = true;
        chosen.push(best);
        total += e.w;
        rows.push([edgeName(e, false), String(e.w), String(total)]);
        rec.add(`${crossing} edge${crossing > 1 ? "s leave" : " leaves"} the tree. The cheapest is ${edgeName(e, false)} (weight ${e.w}), so ${vertexName(added)} joins. Total weight so far: ${total}.`, { vState: marks(added), eState: edges(best), table: table() });
    }
    const size = inTree.filter(Boolean).length;
    rec.add(size === n
        ? `Done. The minimum spanning tree connects all ${n} vertices with ${n - 1} edges and a total weight of ${total}.`
        : `No edge leaves the tree any more, so the rest of the graph cannot be reached from ${S}. The tree covers ${size} of ${n} vertices with a total weight of ${total}.`, { vState: marks(), eState: edges(), table: { head: ["Edge added", "Weight", "Total"], rows } });
    return rec.steps;
}
function boruvka(g) {
    const n = g.vertices.length;
    const rec = new StepRecorder();
    const root = g.vertices.map((_, i) => i);
    const find = (x) => {
        while (root[x] !== x) {
            root[x] = root[root[x]];
            x = root[x];
        }
        return x;
    };
    const chosen = new Set();
    let total = 0;
    let count = n;
    const members = (r) => g.vertices.map((_, i) => i).filter((i) => find(i) === r);
    const edges = (picks = []) => {
        const m = new Map();
        g.edges.forEach((e, i) => {
            if (picks.includes(i))
                m.set(i, "active");
            else if (chosen.has(i))
                m.set(i, "chosen");
            else if (find(e.u) === find(e.v))
                m.set(i, "dim");
        });
        return m;
    };
    rec.add(`Every vertex starts as its own component, so there are ${n} components. All of them grow at the same time.`);
    for (let round = 1; count > 1; round++) {
        const cheapest = new Map();
        g.edges.forEach((e, i) => {
            const a = find(e.u);
            const b = find(e.v);
            if (a === b)
                return;
            for (const r of [a, b]) {
                const current = cheapest.get(r);
                if (current === undefined || e.w < g.edges[current].w)
                    cheapest.set(r, i);
            }
        });
        if (cheapest.size === 0)
            break;
        const roots = Array.from(cheapest.keys()).sort((a, b) => members(a)[0] - members(b)[0]);
        const rows = roots.map((r) => {
            const e = g.edges[cheapest.get(r)];
            return [nameList(members(r)), edgeName(e, false), String(e.w)];
        });
        const picks = Array.from(new Set(cheapest.values()));
        rec.add(`Round ${round}: each of the ${count} components picks its cheapest edge to another component.`, {
            eState: edges(picks),
            table: { head: ["Component", "Cheapest edge out", "Weight"], rows },
        });
        const before = count;
        picks.forEach((i) => {
            const a = find(g.edges[i].u);
            const b = find(g.edges[i].v);
            if (a === b)
                return;
            root[a] = b;
            chosen.add(i);
            total += g.edges[i].w;
            count--;
        });
        rec.add(`Add the ${picks.length} distinct edge${picks.length > 1 ? "s" : ""} that were picked. The components merge from ${before} down to ${count}. Total weight so far: ${total}.`, { eState: edges(), table: { head: ["Component", "Cheapest edge out", "Weight"], rows } });
    }
    const done = new Map(g.vertices.map((_, i) => [i, "done"]));
    rec.add(count === 1
        ? `Done. One component is left: the minimum spanning tree, with ${chosen.size} edges and a total weight of ${total}.`
        : `No component has an edge out any more. The graph is not connected, so the result is a minimum spanning forest of ${count} trees with a total weight of ${total}.`, { vState: count === 1 ? done : undefined, eState: edges() });
    return rec.steps;
}
