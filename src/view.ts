const SVG_NS = "http://www.w3.org/2000/svg";
const VERTEX_RADIUS = 24;

interface RenderOptions {
  directed: boolean;
  showWeights: boolean;
}

function svgNode(tag: string, className: string, attrs: Record<string, number | string> = {}): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  el.setAttribute("class", className);
  for (const key of Object.keys(attrs)) el.setAttribute(key, String(attrs[key]));
  return el;
}

function renderGraph(svg: SVGSVGElement, g: Graph, step: Step | null, options: RenderOptions): void {
  const edgeLayer = svgNode("g", "edges");
  const vertexLayer = svgNode("g", "vertices");
  const R = VERTEX_RADIUS;

  g.edges.forEach((e, i) => {
    const flip = options.directed && step?.reverse === true;
    const a = g.vertices[flip ? e.v : e.u];
    const b = g.vertices[flip ? e.u : e.v];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    const x1 = a.x + ux * R;
    const y1 = a.y + uy * R;
    const tipX = b.x - ux * (R + 2);
    const tipY = b.y - uy * (R + 2);
    const headLength = options.directed ? 15 : 0;
    const x2 = tipX - ux * headLength * 0.8;
    const y2 = tipY - uy * headLength * 0.8;

    const state = step?.eState.get(i);
    const group = svgNode("g", "edge" + (state ? ` is-${state}` : ""));
    group.appendChild(svgNode("line", "edge-halo", { x1, y1, x2: tipX, y2: tipY }));
    group.appendChild(svgNode("line", "edge-line", { x1, y1, x2, y2 }));
    if (options.directed) {
      const bx = tipX - ux * headLength;
      const by = tipY - uy * headLength;
      const points = [
        [tipX, tipY],
        [bx - uy * 7.5, by + ux * 7.5],
        [bx + uy * 7.5, by - ux * 7.5],
      ];
      group.appendChild(svgNode("polygon", "edge-head", { points: points.map((p) => p.map((c) => c.toFixed(1)).join(",")).join(" ") }));
    }
    const text = step?.eLabel.get(i) ?? (options.showWeights ? String(e.w) : "");
    if (text) {
      const label = svgNode("text", "edge-label", { x: (x1 + tipX) / 2, y: (y1 + tipY) / 2 });
      label.textContent = text;
      group.appendChild(label);
    }
    edgeLayer.appendChild(group);
  });

  g.vertices.forEach((v, i) => {
    const state = step?.vState.get(i);
    const group = svgNode("g", "vertex" + (state ? ` is-${state}` : ""), { "data-v": i });
    group.appendChild(svgNode("circle", "vertex-halo", { cx: v.x, cy: v.y, r: R + 9 }));
    group.appendChild(svgNode("circle", "vertex-ring", { cx: v.x, cy: v.y, r: R }));
    const name = svgNode("text", "vertex-name", { x: v.x, y: v.y });
    name.textContent = vertexName(i);
    group.appendChild(name);
    const badge = step?.vLabel.get(i);
    if (badge) {
      const note = svgNode("text", "vertex-note", { x: v.x, y: v.y + R + 20 });
      note.textContent = badge;
      group.appendChild(note);
    }
    vertexLayer.appendChild(group);
  });

  svg.replaceChildren(edgeLayer, vertexLayer);
}
