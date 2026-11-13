"use strict";
function eulerPath(g) {
    const n = g.vertices.length;
    const m = g.edges.length;
    const rec = new StepRecorder();
    if (m === 0) {
        rec.add("This graph has no edges to walk along. Add some edges first.");
        return rec.steps;
    }
    const degree = new Array(n).fill(0);
    g.edges.forEach((e) => {
        degree[e.u]++;
        degree[e.v]++;
    });
    const degreeLabels = new Map(degree.map((d, i) => [i, `degree ${d}`]));
    const used = new Array(m).fill(false);
    const reach = (from, skip = -1) => {
        const seen = new Set([from]);
        const stack = [from];
        while (stack.length) {
            const x = stack.pop();
            g.edges.forEach((e, i) => {
                if (used[i] || i === skip || (e.u !== x && e.v !== x))
                    return;
                const y = e.u === x ? e.v : e.u;
                if (!seen.has(y)) {
                    seen.add(y);
                    stack.push(y);
                }
            });
        }
        return seen.size;
    };
    const odd = degree.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
    const first = degree.findIndex((d) => d > 0);
    const touched = degree.filter((d) => d > 0).length;
    if (reach(first) !== touched) {
        rec.add("The edges lie in more than one separate piece, so no single walk can cover them all. No Euler path exists.", { vLabel: degreeLabels });
        return rec.steps;
    }
    if (odd.length !== 0 && odd.length !== 2) {
        rec.add(`An Euler path needs exactly 0 or 2 vertices of odd degree. This graph has ${odd.length} (${odd.map(vertexName).join(", ")}), so no Euler path exists.`, { vLabel: degreeLabels, vState: new Map(odd.map((i) => [i, "warn"])) });
        return rec.steps;
    }
    const circuit = odd.length === 0;
    const start = circuit ? first : odd[0];
    let current = start;
    const walk = [start];
    const moves = [];
    const order = new Map();
    const state = new Map();
    const table = () => ({ head: ["Move", "Edge"], rows: moves, mark: moves.length - 1 });
    rec.add(circuit
        ? `Every vertex has even degree, so an Euler circuit exists and can start anywhere. Start at ${vertexName(start)}.`
        : `Exactly two vertices have odd degree, ${vertexName(odd[0])} and ${vertexName(odd[1])}, so an Euler path exists and must run between them. Start at ${vertexName(start)}.`, { vLabel: degreeLabels, vState: new Map([[start, "active"]]) });
    for (let move = 1; move <= m; move++) {
        const options = g.edges.map((_, i) => i).filter((i) => !used[i] && (g.edges[i].u === current || g.edges[i].v === current));
        const here = vertexName(current);
        const far = (i) => (g.edges[i].u === current ? g.edges[i].v : g.edges[i].u);
        const label = (i) => `${here}–${vertexName(far(i))}`;
        let pick = options[0];
        let why = `${label(pick)} is the only edge left here, so take it.`;
        if (options.length > 1) {
            const size = reach(current);
            const bridges = options.filter((i) => reach(current, i) < size);
            pick = options.find((i) => !bridges.includes(i));
            why = bridges.length
                ? `${label(bridges[0])} is a bridge: crossing it now would cut off the edges still unused behind it. Take ${label(pick)} instead.`
                : `None of the edges here is a bridge. Take ${label(pick)}.`;
        }
        used[pick] = true;
        const next = far(pick);
        moves.push([String(move), label(pick)]);
        order.set(pick, String(move));
        const es = new Map(state);
        es.set(pick, "active");
        state.set(pick, "chosen");
        current = next;
        walk.push(current);
        rec.add(`At ${here}. ${why}`, {
            vState: new Map([[current, "active"]]),
            eState: es,
            eLabel: order,
            table: table(),
        });
    }
    rec.add(`Done. The Euler ${circuit ? "circuit" : "path"} is ${walk.map(vertexName).join(" → ")}. It uses each of the ${m} edges exactly once; the numbers show the order.`, {
        vState: new Map([
            [start, "source"],
            [current, circuit ? "source" : "sink"],
        ]),
        eState: state,
        eLabel: order,
        table: { head: ["Move", "Edge"], rows: moves },
    });
    return rec.steps;
}
