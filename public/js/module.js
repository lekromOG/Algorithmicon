"use strict";
const MAX_VERTICES = 14;
const MAX_WEIGHT = 99;
const STAGE_W = 1000;
const STAGE_H = 620;
function vertexName(i) {
    return String.fromCharCode(65 + i);
}
function nameList(list, separator = ", ") {
    return list.map(vertexName).join(separator);
}
function edgeName(e, directed) {
    return vertexName(e.u) + (directed ? "→" : "–") + vertexName(e.v);
}
function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function formatDistance(d) {
    return d === Infinity ? "∞" : String(d);
}
function adjacency(g, directed) {
    const out = g.vertices.map(() => []);
    g.edges.forEach((e, i) => {
        out[e.u].push({ to: e.v, edge: i });
        if (!directed)
            out[e.v].push({ to: e.u, edge: i });
    });
    return out;
}
class StepRecorder {
    constructor() {
        this.steps = [];
    }
    add(text, extras = {}) {
        this.steps.push({
            text,
            vState: new Map(extras.vState ?? []),
            eState: new Map(extras.eState ?? []),
            vLabel: new Map(extras.vLabel ?? []),
            eLabel: new Map(extras.eLabel ?? []),
            table: extras.table,
            reverse: extras.reverse,
        });
    }
}
