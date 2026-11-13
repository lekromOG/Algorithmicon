"use strict";
function dinic(g, source, sink) {
    const n = g.vertices.length;
    const rec = new StepRecorder();
    const S = vertexName(source);
    const T = vertexName(sink);
    if (source === sink) {
        rec.add("The source and the sink are the same vertex. Pick two different vertices.");
        return rec.steps;
    }
    const cap = g.edges.map((e) => Math.max(0, e.w));
    const flow = g.edges.map(() => 0);
    const moves = g.vertices.map(() => []);
    g.edges.forEach((e, i) => {
        if (cap[i] === 0)
            return;
        moves[e.u].push({ i, dir: 1, to: e.v });
        moves[e.v].push({ i, dir: -1, to: e.u });
    });
    const room = (m) => (m.dir > 0 ? cap[m.i] - flow[m.i] : flow[m.i]);
    const labels = () => new Map(g.edges.map((_, i) => [i, cap[i] > 0 ? `${flow[i]}/${cap[i]}` : "–"]));
    const ends = () => new Map([
        [source, "source"],
        [sink, "sink"],
    ]);
    const base = () => {
        const m = new Map();
        g.edges.forEach((_, i) => {
            if (cap[i] === 0)
                m.set(i, "dim");
            else if (flow[i] > 0)
                m.set(i, "chosen");
        });
        return m;
    };
    const table = () => ({
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
    for (let phase = 1;; phase++) {
        const level = new Array(n).fill(-1);
        level[source] = 0;
        const queue = [source];
        while (queue.length) {
            const x = queue.shift();
            moves[x].forEach((m) => {
                if (level[m.to] < 0 && room(m) > 0) {
                    level[m.to] = level[x] + 1;
                    queue.push(m.to);
                }
            });
        }
        const levelLabels = new Map(level.map((l, i) => [i, l < 0 ? "" : `level ${l}`]).filter(([, t]) => t));
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
                if (l >= 0 && i !== source)
                    vs.set(i, "done");
            });
            rec.add(`Phase ${phase}: the search from ${S} no longer reaches ${T}, so the maximum flow is ${total}. ` +
                (total > 0
                    ? `The dotted edges are full and separate what ${S} can still reach from the rest. They form a minimum cut with the same capacity, ${cutCap}.`
                    : `${T} cannot be reached from ${S} at all.`), { vState: vs, eState: cut, eLabel: labels(), table: table() });
            return rec.steps;
        }
        const layered = base();
        g.edges.forEach((e, i) => {
            const forward = level[e.u] >= 0 && level[e.v] === level[e.u] + 1 && flow[i] < cap[i];
            const backward = level[e.v] >= 0 && level[e.u] === level[e.v] + 1 && flow[i] > 0;
            if (cap[i] > 0 && (forward || backward))
                layered.set(i, "active");
        });
        rec.add(`Phase ${phase}: a breadth-first search gives every vertex its level, the number of usable edges from ${S}. Only moves that go exactly one level deeper are allowed in this phase.`, { vState: ends(), eState: layered, vLabel: levelLabels, eLabel: labels(), table: table() });
        const next = new Array(n).fill(0);
        const hops = [];
        const push = (x, limit) => {
            if (x === sink)
                return limit;
            for (; next[x] < moves[x].length; next[x]++) {
                const m = moves[x][next[x]];
                if (level[m.to] !== level[x] + 1 || room(m) <= 0)
                    continue;
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
            if (sent === 0)
                break;
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
function hopcroftKarp(g) {
    const n = g.vertices.length;
    const rec = new StepRecorder();
    const adj = adjacency(g, false);
    const side = new Array(n).fill(-1);
    for (let s = 0; s < n; s++) {
        if (side[s] >= 0)
            continue;
        side[s] = 0;
        const queue = [s];
        while (queue.length) {
            const x = queue.shift();
            for (const { to, edge } of adj[x]) {
                if (side[to] < 0) {
                    side[to] = 1 - side[x];
                    queue.push(to);
                }
                else if (side[to] === side[x]) {
                    rec.add(`Matching needs two sides with every edge crossing between them. ${edgeName(g.edges[edge], false)} joins two vertices that must be on the same side, so this graph is not bipartite.`, {
                        eState: new Map([[edge, "rejected"]]),
                        vState: new Map([
                            [x, "warn"],
                            [to, "warn"],
                        ]),
                    });
                    return rec.steps;
                }
            }
        }
    }
    const left = side.map((s, i) => (s === 0 ? i : -1)).filter((i) => i >= 0);
    const right = side.map((s, i) => (s === 1 ? i : -1)).filter((i) => i >= 0);
    const pair = new Array(n).fill(-1);
    const edgeBetween = (a, b) => adj[a].find((h) => h.to === b).edge;
    const size = () => left.filter((u) => pair[u] >= 0).length;
    const marks = () => new Map(pair.map((p, i) => [i, "done"]).filter(([i]) => pair[i] >= 0));
    const sideLabels = new Map(side.map((s, i) => [i, s === 0 ? "left" : "right"]));
    const matching = () => {
        const m = new Map();
        left.forEach((u) => {
            if (pair[u] >= 0)
                m.set(edgeBetween(u, pair[u]), "chosen");
        });
        return m;
    };
    const table = () => ({
        head: ["Left vertex", "Matched with"],
        rows: left.map((u) => [vertexName(u), pair[u] >= 0 ? vertexName(pair[u]) : "—"]),
    });
    rec.add(`Split the vertices into two sides so that every edge crosses: left {${nameList(left)}}, right {${nameList(right)}}. Nothing is matched yet.`, { vLabel: sideLabels, table: table() });
    for (let phase = 1;; phase++) {
        const dist = new Array(n).fill(Infinity);
        const queue = [];
        left.forEach((u) => {
            if (pair[u] < 0) {
                dist[u] = 0;
                queue.push(u);
            }
        });
        let reachable = false;
        while (queue.length) {
            const u = queue.shift();
            adj[u].forEach(({ to }) => {
                const w = pair[to];
                if (w < 0)
                    reachable = true;
                else if (dist[w] === Infinity) {
                    dist[w] = dist[u] + 1;
                    queue.push(w);
                }
            });
        }
        if (!reachable)
            break;
        const search = (u) => {
            for (const { to } of adj[u]) {
                const w = pair[to];
                if (w < 0)
                    return [u, to];
                if (dist[w] === dist[u] + 1) {
                    const rest = search(w);
                    if (rest)
                        return [u, to, ...rest];
                }
            }
            dist[u] = Infinity;
            return null;
        };
        for (const u of left) {
            if (pair[u] >= 0)
                continue;
            const path = search(u);
            if (!path)
                continue;
            const pathEdges = path.slice(1).map((v, k) => edgeBetween(path[k], v));
            if (path.length > 2) {
                const es = matching();
                pathEdges.forEach((e) => es.set(e, es.get(e) === "chosen" ? "rejected" : "active"));
                rec.add(`Phase ${phase}: ${nameList(path, " – ")} is an augmenting path. It starts and ends at unmatched vertices and its edges alternate between unmatched and matched (dotted).`, { vState: marks(), eState: es, table: table() });
            }
            for (let k = 0; k < path.length; k += 2) {
                pair[path[k]] = path[k + 1];
                pair[path[k + 1]] = path[k];
            }
            const es = matching();
            pathEdges.forEach((e) => {
                if (es.get(e) === "chosen")
                    es.set(e, "active");
            });
            rec.add((path.length > 2
                ? `Swap the roles along that path: matched edges are dropped and the others are matched instead.`
                : `Phase ${phase}: ${vertexName(path[0])} and ${vertexName(path[1])} are both unmatched, so match them directly.`) +
                ` The matching now has ${size()} pair${size() > 1 ? "s" : ""}.`, { vState: marks(), eState: es, table: table() });
        }
    }
    const free = left.concat(right).filter((v) => pair[v] < 0 && adj[v].length > 0);
    rec.add(`Done. No augmenting path is left, so the matching of ${size()} pair${size() === 1 ? "" : "s"} is as large as possible.` +
        (free.length ? ` ${nameList(free)} ${free.length > 1 ? "stay" : "stays"} unmatched.` : " Every vertex is matched."), { vState: marks(), eState: matching(), vLabel: sideLabels, table: table() });
    return rec.steps;
}
