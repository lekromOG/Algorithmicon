(() => {
  function byId<T extends Element>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as unknown as T;
  }

  function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  const stage = byId<SVGSVGElement>("stage");
  const workbench = byId<HTMLElement>("workbench");
  const linePicker = byId<HTMLElement>("line-picker");
  const stopPicker = byId<HTMLElement>("stop-picker");
  const reads = byId<HTMLElement>("algo-reads");
  const stepText = byId<HTMLElement>("step-text");
  const stepCount = byId<HTMLElement>("step-count");
  const scrub = byId<HTMLInputElement>("scrub");
  const firstBtn = byId<HTMLButtonElement>("btn-first");
  const prevBtn = byId<HTMLButtonElement>("btn-prev");
  const playBtn = byId<HTMLButtonElement>("btn-play");
  const nextBtn = byId<HTMLButtonElement>("btn-next");
  const speed = byId<HTMLSelectElement>("speed");
  const sourceField = byId<HTMLElement>("source-field");
  const sinkField = byId<HTMLElement>("sink-field");
  const endsGroup = byId<HTMLElement>("ends-group");
  const sourceSelect = byId<HTMLSelectElement>("source-select");
  const sinkSelect = byId<HTMLSelectElement>("sink-select");
  const vertexInput = byId<HTMLInputElement>("vertex-count");
  const edgeInput = byId<HTMLInputElement>("edge-count");
  const generateBtn = byId<HTMLButtonElement>("btn-generate");
  const exampleBtn = byId<HTMLButtonElement>("btn-example");
  const negativeBtn = byId<HTMLButtonElement>("btn-negative");
  const edgeList = byId<HTMLTextAreaElement>("edge-list");
  const applyBtn = byId<HTMLButtonElement>("btn-apply");
  const graphError = byId<HTMLElement>("graph-error");
  const tableBox = byId<HTMLElement>("state-table");
  const routeBadge = byId<HTMLElement>("route-badge");
  const routeTitle = byId<HTMLElement>("route-title");
  const routeSummary = byId<HTMLElement>("route-summary");
  const routeStations = byId<HTMLElement>("route-stations");
  const routeFacts = byId<HTMLElement>("route-facts");
  const catalogBody = byId<HTMLElement>("catalog-body");
  const themeBtn = byId<HTMLButtonElement>("theme-toggle");

  const byAlgoId = new Map(ALGORITHMS.map((a) => [a.id, a] as [AlgoId, AlgoInfo]));
  const lineOf = new Map(LINES.map((l) => [l.id, l] as [LineId, LineInfo]));

  let algo: AlgoInfo = ALGORITHMS.find((a) => a.id === "dijkstra") as AlgoInfo;
  let graph: Graph = EXAMPLES[algo.id]();
  let pristine = true;
  let steps: Step[] = [];
  let index = 0;
  let timer: number | undefined;

  function readInt(input: HTMLInputElement, min: number, max: number, fallback: number): number {
    const parsed = Number.parseInt(input.value, 10);
    const value = clampNumber(Number.isFinite(parsed) ? parsed : fallback, min, max);
    input.value = String(value);
    return value;
  }

  function fillSelect(select: HTMLSelectElement, count: number, preferred: number): void {
    const keep = select.value === "" ? preferred : Number(select.value);
    select.replaceChildren();
    for (let i = 0; i < count; i++) {
      const option = make("option", "", vertexName(i));
      option.value = String(i);
      select.appendChild(option);
    }
    select.value = String(keep < count ? keep : preferred);
  }

  function renderTable(table: StepTable | undefined): void {
    tableBox.replaceChildren();
    if (!table || table.rows.length === 0) {
      tableBox.appendChild(make("p", "table-empty", "Nothing to list at this step yet."));
      return;
    }
    const el = make("table");
    const headRow = el.createTHead().insertRow();
    table.head.forEach((title) => {
      const th = make("th", "", title);
      th.scope = "col";
      headRow.appendChild(th);
    });
    const body = el.createTBody();
    let marked: HTMLElement | undefined;
    table.rows.forEach((cells, r) => {
      const row = body.insertRow();
      if (r === table.mark) {
        row.className = "is-current";
        marked = row;
      }
      cells.forEach((text, c) => {
        const cell = row.insertCell();
        cell.textContent = text;
        if (table.markCell && table.markCell[0] === r && table.markCell[1] === c) {
          cell.className = "is-current-cell";
          marked = cell;
        }
      });
    });
    tableBox.appendChild(el);
    if (marked) tableBox.scrollTop = marked.offsetTop - tableBox.clientHeight / 2;
  }

  function draw(): void {
    renderGraph(stage, graph, steps[index] ?? null, algo);
  }

  function show(i: number): void {
    index = clampNumber(i, 0, steps.length - 1);
    const step = steps[index];
    draw();
    stepText.textContent = step.text;
    stepCount.textContent = `Step ${index + 1} of ${steps.length}`;
    scrub.max = String(steps.length - 1);
    scrub.value = String(index);
    firstBtn.disabled = prevBtn.disabled = index === 0;
    nextBtn.disabled = index === steps.length - 1;
    renderTable(step.table);
  }

  function pause(): void {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    playBtn.textContent = "Play";
    playBtn.setAttribute("aria-pressed", "false");
  }

  function play(): void {
    if (index >= steps.length - 1) show(0);
    playBtn.textContent = "Pause";
    playBtn.setAttribute("aria-pressed", "true");
    timer = window.setInterval(() => {
      if (index >= steps.length - 1) pause();
      else show(index + 1);
    }, Number(speed.value) || 900);
  }

  function recompute(): void {
    pause();
    steps = algo.run(graph, Number(sourceSelect.value), Number(sinkSelect.value));
    show(0);
  }

  function setGraph(next: Graph, isExample: boolean): void {
    graph = next;
    pristine = isExample;
    const n = graph.vertices.length;
    vertexInput.value = String(n);
    edgeInput.max = String(maxEdgesFor(n));
    edgeInput.value = String(graph.edges.length);
    sourceSelect.value = sinkSelect.value = "";
    fillSelect(sourceSelect, n, 0);
    fillSelect(sinkSelect, n, n - 1);
    edgeList.value = formatEdgeList(graph);
    graphError.textContent = "";
    stage.setAttribute("aria-label", `Graph with ${n} vertices and ${graph.edges.length} edges. Each step is described in the text below.`);
    recompute();
  }

  function radio(group: string, value: string, checked: boolean): HTMLInputElement {
    const input = make("input");
    input.type = "radio";
    input.name = group;
    input.value = value;
    input.checked = checked;
    return input;
  }

  function badge(line: LineInfo): HTMLElement {
    const el = make("span", "line-badge", line.letter);
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function buildLines(): void {
    LINES.forEach((line) => {
      const count = ALGORITHMS.filter((a) => a.line === line.id).length;
      const label = make("label", "line-tab");
      label.dataset.line = line.id;
      const input = radio("line", line.id, line.id === algo.line);
      input.addEventListener("change", () => {
        const firstStop = ALGORITHMS.find((a) => a.line === line.id);
        if (input.checked && firstStop) selectAlgo(firstStop.id);
      });
      const text = make("span", "line-text");
      text.append(make("b", "", line.name), make("small", "", `${count} algorithms`));
      label.append(input, badge(line), text);
      linePicker.appendChild(label);
    });
  }

  function buildStops(): void {
    const legend = make("legend", "visually-hidden", `${(lineOf.get(algo.line) as LineInfo).name} algorithms`);
    stopPicker.replaceChildren(legend);
    ALGORITHMS.filter((a) => a.line === algo.line).forEach((a) => {
      const label = make("label", "stop");
      const input = radio("algo", a.id, a.id === algo.id);
      input.addEventListener("change", () => {
        if (input.checked) selectAlgo(a.id);
      });
      label.append(input, make("span", "", a.name));
      stopPicker.appendChild(label);
    });
  }

  function buildRoute(): void {
    routeBadge.textContent = (lineOf.get(algo.line) as LineInfo).letter;
    routeTitle.textContent = `How ${algo.name} works`;
    routeSummary.textContent = algo.summary;
    routeStations.replaceChildren(...algo.stations.map((s) => make("li", "", s)));
    const facts: [string, string][] = [
      ["Time", algo.time],
      ["Graph", algo.graph],
      ["Choose it when", algo.when],
    ];
    routeFacts.replaceChildren(
      ...facts.map(([term, detail]) => {
        const row = make("div");
        row.append(make("dt", "", term), make("dd", "", detail));
        return row;
      })
    );
  }

  function buildCatalog(): void {
    ALGORITHMS.forEach((a) => {
      const line = lineOf.get(a.line) as LineInfo;
      const row = make("tr");
      row.dataset.line = a.line;
      const head = make("th");
      head.scope = "row";
      const button = make("button", "catalog-run");
      button.type = "button";
      button.append(badge(line), make("span", "", a.name));
      button.setAttribute("aria-label", `Run ${a.name} on the workbench`);
      button.addEventListener("click", () => {
        pristine = true;
        selectAlgo(a.id);
        workbench.scrollIntoView();
      });
      head.appendChild(button);
      row.append(head, make("td", "", a.answers), make("td", "", a.graph), make("td", "", a.time));
      catalogBody.appendChild(row);
    });
  }

  function selectAlgo(id: AlgoId): void {
    const lineChanged = byAlgoId.get(id)?.line !== algo.line;
    algo = byAlgoId.get(id) as AlgoInfo;
    document.body.dataset.line = algo.line;
    linePicker.querySelectorAll<HTMLInputElement>("input").forEach((input) => (input.checked = input.value === algo.line));
    if (lineChanged || !stopPicker.querySelector("input")) buildStops();
    stopPicker.querySelectorAll<HTMLInputElement>("input").forEach((input) => (input.checked = input.value === id));
    reads.textContent = algo.reads;
    sourceField.hidden = !algo.needsSource;
    sinkField.hidden = !algo.needsSink;
    endsGroup.hidden = !algo.needsSource && !algo.needsSink;
    negativeBtn.hidden = id !== "bellman-ford" && id !== "floyd-warshall";
    buildRoute();
    if (pristine) setGraph(EXAMPLES[id](), true);
    else recompute();
  }

  firstBtn.addEventListener("click", () => {
    pause();
    show(0);
  });
  prevBtn.addEventListener("click", () => {
    pause();
    show(index - 1);
  });
  nextBtn.addEventListener("click", () => {
    pause();
    show(index + 1);
  });
  playBtn.addEventListener("click", () => (timer === undefined ? play() : pause()));
  scrub.addEventListener("input", () => {
    pause();
    show(Number(scrub.value));
  });
  speed.addEventListener("change", () => {
    if (timer !== undefined) {
      pause();
      play();
    }
  });
  workbench.addEventListener("keydown", (ev) => {
    const target = ev.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    if (ev.key === "ArrowRight") {
      pause();
      show(index + 1);
    } else if (ev.key === "ArrowLeft") {
      pause();
      show(index - 1);
    }
  });

  sourceSelect.addEventListener("change", recompute);
  sinkSelect.addEventListener("change", recompute);
  vertexInput.addEventListener("change", () => {
    const n = readInt(vertexInput, 2, MAX_VERTICES, graph.vertices.length);
    edgeInput.max = String(maxEdgesFor(n));
    readInt(edgeInput, 1, maxEdgesFor(n), n);
  });
  edgeInput.addEventListener("change", () => {
    const n = readInt(vertexInput, 2, MAX_VERTICES, graph.vertices.length);
    readInt(edgeInput, 1, maxEdgesFor(n), n);
  });
  generateBtn.addEventListener("click", () => {
    const n = readInt(vertexInput, 2, MAX_VERTICES, graph.vertices.length);
    const m = readInt(edgeInput, 1, maxEdgesFor(n), n);
    setGraph(randomGraph(n, m), false);
  });
  exampleBtn.addEventListener("click", () => setGraph(EXAMPLES[algo.id](), true));
  negativeBtn.addEventListener("click", () => setGraph(negativeCycleExample(), false));
  applyBtn.addEventListener("click", () => {
    const parsed = parseEdgeList(edgeList.value);
    if (!parsed.ok) {
      graphError.textContent = parsed.error;
      return;
    }
    const sameSize = parsed.vertexCount === graph.vertices.length;
    setGraph({ vertices: sameSize ? graph.vertices : circleLayout(parsed.vertexCount), edges: parsed.edges }, false);
  });

  let dragged = -1;
  stage.addEventListener("pointerdown", (ev) => {
    const hit = (ev.target as Element).closest("[data-v]");
    if (!hit) return;
    dragged = Number(hit.getAttribute("data-v"));
    stage.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  stage.addEventListener("pointermove", (ev) => {
    const vertex = graph.vertices[dragged];
    const matrix = stage.getScreenCTM();
    if (!vertex || !matrix) return;
    const point = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(matrix.inverse());
    vertex.x = Math.round(clampNumber(point.x, 40, STAGE_W - 40));
    vertex.y = Math.round(clampNumber(point.y, 40, STAGE_H - 60));
    draw();
  });
  const drop = (): void => {
    if (dragged >= 0 && algo.usesLayout) recompute();
    dragged = -1;
  };
  stage.addEventListener("pointerup", drop);
  stage.addEventListener("pointercancel", drop);

  const labelTheme = (): void => {
    themeBtn.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
  };
  themeBtn.addEventListener("click", () => {
    saveTheme(currentTheme() === "dark" ? "light" : "dark");
    labelTheme();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", labelTheme);
  labelTheme();

  buildLines();
  buildCatalog();
  selectAlgo(algo.id);
})();
