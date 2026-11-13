"use strict";
function circleLayout(n, jitter = 0) {
    const cx = STAGE_W / 2;
    const cy = STAGE_H / 2 - 10;
    return Array.from({ length: n }, (_, i) => {
        const angle = Math.PI + (2 * Math.PI * i) / n;
        const wobble = jitter ? (Math.random() * 2 - 1) * jitter : 0;
        return {
            x: Math.round(cx + (380 + wobble) * Math.cos(angle)),
            y: Math.round(cy + (225 + wobble) * Math.sin(angle)),
        };
    });
}
function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}
function maxEdgesFor(n) {
    return (n * (n - 1)) / 2;
}
function randomGraph(vertexCount, edgeCount) {
    const n = clampNumber(Math.trunc(vertexCount) || 2, 2, MAX_VERTICES);
    const m = clampNumber(Math.trunc(edgeCount) || 0, 0, maxEdgesFor(n));
    const edges = [];
    const taken = new Set();
    const add = (u, v) => {
        taken.add(`${u}-${v}`);
        edges.push({ u, v, w: randomInt(1, 9) });
    };
    for (let v = 1; v < n && edges.length < m; v++)
        add(randomInt(0, v - 1), v);
    const spare = [];
    for (let u = 0; u < n; u++) {
        for (let v = u + 1; v < n; v++) {
            if (!taken.has(`${u}-${v}`))
                spare.push([u, v]);
        }
    }
    while (edges.length < m && spare.length) {
        const [pair] = spare.splice(randomInt(0, spare.length - 1), 1);
        add(pair[0], pair[1]);
    }
    return { vertices: circleLayout(n, 18), edges };
}
const EDGE_LIST_MAX_CHARS = 2000;
function parseEdgeList(text) {
    if (text.length > EDGE_LIST_MAX_CHARS) {
        return { ok: false, error: `The edge list is too long. Keep it under ${EDGE_LIST_MAX_CHARS} characters.` };
    }
    const lastLetter = vertexName(MAX_VERTICES - 1);
    const edges = [];
    const seen = new Set();
    let highest = 1;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        const where = `Line ${i + 1}`;
        const match = /^([A-Za-z])[\s,]+([A-Za-z])(?:[\s,]+([+-]?\d{1,3}))?$/.exec(line);
        if (!match) {
            return { ok: false, error: `${where} is not an edge. Write two vertex letters and an optional weight, for example "A B 4".` };
        }
        const u = match[1].toUpperCase().charCodeAt(0) - 65;
        const v = match[2].toUpperCase().charCodeAt(0) - 65;
        const w = match[3] === undefined ? 1 : parseInt(match[3], 10);
        if (u >= MAX_VERTICES || v >= MAX_VERTICES) {
            return { ok: false, error: `${where} uses a vertex beyond ${lastLetter}. Use the letters A to ${lastLetter}.` };
        }
        if (u === v) {
            return { ok: false, error: `${where} connects ${vertexName(u)} to itself. Loops are not supported.` };
        }
        if (Math.abs(w) > MAX_WEIGHT) {
            return { ok: false, error: `${where} has a weight outside -${MAX_WEIGHT} to ${MAX_WEIGHT}.` };
        }
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (seen.has(key)) {
            return { ok: false, error: `${where} repeats the edge between ${vertexName(u)} and ${vertexName(v)}. Keep one edge per pair.` };
        }
        seen.add(key);
        edges.push({ u, v, w });
        highest = Math.max(highest, u, v);
    }
    if (edges.length === 0) {
        return { ok: false, error: 'The edge list is empty. Add at least one line such as "A B 4".' };
    }
    return { ok: true, vertexCount: highest + 1, edges };
}
function formatEdgeList(g) {
    return g.edges.map((e) => `${vertexName(e.u)} ${vertexName(e.v)} ${e.w}`).join("\n");
}
function buildGraph(points, edgeList) {
    const parsed = parseEdgeList(edgeList);
    if (!parsed.ok)
        throw new Error(parsed.error);
    return { vertices: points.map(([x, y]) => ({ x, y })), edges: parsed.edges };
}
const HEXAGON = [
    [110, 300], [370, 130], [370, 470], [640, 130], [640, 470], [890, 300],
];
const negativeRoads = () => buildGraph(HEXAGON, "A B 6\nA C 4\nB D 5\nC B -2\nC E 9\nB E 3\nD F 4\nE F 6\nE D -3");
const roads = () => buildGraph(HEXAGON, "A B 6\nA C 4\nB D 5\nC B 1\nC E 9\nB E 3\nD F 4\nE F 6\nE D 2");
const pipes = () => buildGraph(HEXAGON, "A B 16\nA C 13\nB D 12\nC B 4\nC E 14\nD C 9\nD F 20\nE D 7\nE F 4");
const network = () => buildGraph([[130, 210], [370, 110], [640, 110], [870, 240], [760, 480], [480, 410], [220, 480]], "A B 7\nA G 5\nB G 9\nB C 8\nB F 7\nC F 5\nC D 6\nD E 9\nD F 15\nE F 8\nF G 6");
const clusters = () => buildGraph([[110, 170], [110, 440], [310, 305], [500, 305], [680, 150], [680, 460], [880, 460], [880, 150]], "A B\nB C\nC A\nC D\nD E\nE F\nF D\nF G\nG H\nE H");
function negativeCycleExample() {
    const g = negativeRoads();
    g.edges.push({ u: 3, v: 2, w: 1 });
    return g;
}
function mapExample() {
    const g = buildGraph([[90, 330], [290, 150], [300, 480], [520, 100], [510, 320], [560, 520], [760, 190], [900, 400]], "A B\nA C\nB D\nB E\nC E\nC F\nD G\nE G\nE H\nF H\nG H");
    g.edges.forEach((e) => {
        const a = g.vertices[e.u];
        const b = g.vertices[e.v];
        e.w = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 100));
    });
    return g;
}
const EXAMPLES = {
    bfs: network,
    dfs: network,
    dijkstra: roads,
    "bellman-ford": negativeRoads,
    "floyd-warshall": () => buildGraph([[150, 170], [500, 110], [850, 190], [700, 470], [260, 460]], "A B 4\nB C 3\nC D 2\nD E -1\nE B 2\nA E 7\nA D 9"),
    "a-star": mapExample,
    kruskal: network,
    prim: network,
    boruvka: network,
    topological: roads,
    tarjan: clusters,
    kosaraju: clusters,
    "ford-fulkerson": pipes,
    dinic: pipes,
    "hopcroft-karp": () => buildGraph([[250, 90], [250, 230], [250, 370], [250, 510], [750, 90], [750, 230], [750, 370], [750, 510]], "A E\nA F\nB E\nC F\nC G\nD G\nD H"),
    euler: () => buildGraph([[130, 150], [130, 450], [380, 300], [620, 300], [870, 150], [870, 450]], "C D\nB C\nA B\nA C\nD E\nE F\nD F"),
    hierholzer: () => buildGraph([[110, 160], [110, 460], [330, 310], [600, 310], [465, 110], [860, 160], [860, 460]], "A B\nB C\nA C\nC D\nD E\nC E\nD F\nF G\nD G"),
    cycle: negativeCycleExample,
};
