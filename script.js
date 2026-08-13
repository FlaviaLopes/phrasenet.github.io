/****************************************************************************************
 * PhraseNet – Versão JavaScript (portada do Python)
 ****************************************************************************************/

const PATTERNS = {
    "x and y": /(\w+)\s+and\s+(\w+)/gi,
    "x of the y": /(\w+)\s+of the\s+(\w+)/gi,
    "x the y": /(\w+)\s+the\s+(\w+)/gi,
    "x's y": /(\w+)'s\s+(\w+)/gi,
    "x a y": /(\w+)\s+a\s+(\w+)/gi,
    "x at y": /(\w+)\s+at\s+(\w+)/gi,
    "x is y": /(\w+)\s+is\s+(\w+)/gi,
    "x [space] y": /(\w+)\s+(\w+)/gi
};

const PERMITTED_STOPWORDS = ["and", "of the", "the", "'s", "a", "at", "is"];
const PUNCT_RE = /[^A-Za-z0-9\.' ]+/g;

/* -------------------------------------------------------------------------- */
/* 🟩 Funções utilitárias                                                     */
/* -------------------------------------------------------------------------- */

// Normalização min–max (igual ao Python)
function minmax(values) {
    if (!values.length) return [];
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    if (minV === maxV) return new Array(values.length).fill(0.5);
    return values.map(v => (v - minV) / (maxV - minV));
}

// Conta frequências igual ao Counter do Python
function countTermFrequencies(text) {
    const words = text.split(/\s+/);
    const freq = {};
    for (let w of words) {
        if (!w) continue;
        freq[w] = (freq[w] || 0) + 1;
    }
    return freq;
}

/* -------------------------------------------------------------------------- */
/* 🟦 PhraseNet CLASS                                                         */
/* -------------------------------------------------------------------------- */

class PhraseNet {

    constructor() {}

    /* -------------------------------- TEXT ------------------------------- */

    processSentence(text) {
        let t = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        t = t.replace(/"/g, "'");
        t = t.replace(PUNCT_RE, "");
        t = t.toLowerCase();
        return t;
    }

    textPrep0(text) {
        this.P = text
            .split(".")
            .map(s => this.processSentence(s))
            .filter(s => s.length > 0);

        this.F = countTermFrequencies(this.P.join(" "));
    }

    /* ------------------------------ PHRASE NET --------------------------- */

    extractPairs(pattern, stopwords) {
        //this.stopwords = new Set(stopwords.filter(s => !PERMITTED_STOPWORDS.includes(s)));
        this.stopwords = new Set(stopwords)
        this.pattern = pattern.toLowerCase();
        this.regex = PATTERNS[this.pattern] || new RegExp(`(\\w+)\\s+${this.pattern}\\s+(\\w+)`, "gi");

        const filteredSentences = this.P.map(sentence => {
            const tokens = sentence.split(" ").filter(tok => !this.stopwords.has(tok));
            return tokens.join(" ");
        });

        const nodes = {};
        const edges = {};

        filteredSentences.forEach(line => {
            const matches = [...line.matchAll(this.regex)];
            for (let m of matches) {
                const x = m[1];
                const y = m[2];
                edges[`${x}|${y}`] = (edges[`${x}|${y}`] || 0) + 1;
                nodes[x] = this.F[x] || 1;
                nodes[y] = this.F[y] || 1;
            }
        });

        this.graph_json = {
            pattern: this.pattern,
            nodes: Object.keys(nodes).map(k => ({ id: k, weight: nodes[k] })),
            edges: Object.keys(edges).map(k => {
                const [src, dst] = k.split("|");
                return { source: src, target: dst, weight: edges[k] };
            })
        };
    }

    /* ----------------------------- METRICS -------------------------------- */

    calculateMeasures(graph_json) {
        const nodeIds = graph_json.nodes.map(n => n.id);

        const outdeg = {};
        const indeg = {};
        const ratio = {};

        nodeIds.forEach(n => {
            outdeg[n] = 0;
            indeg[n] = 0;
        });

        graph_json.edges.forEach(e => {
            outdeg[e.source] += e.weight;
            indeg[e.target] += e.weight;
        });

        nodeIds.forEach(n => {
            ratio[n] = outdeg[n] / (indeg[n] + 1);
        });

        const newJson = {
            pattern: graph_json.pattern,
            nodes: graph_json.nodes.map(n => ({
                id: n.id,
                weight: n.weight,
                outdegree: outdeg[n.id],
                indegree: indeg[n.id],
                ratio: ratio[n.id]
            })),
            edges: [...graph_json.edges]
        };

        return newJson;
    }

    /* ----------------------------- FILTER --------------------------------- */

    filterGraph(graph_json, max_nodes) {
        const sorted = [...graph_json.nodes].sort((a, b) => b.weight - a.weight);
        const topNodes = sorted.slice(0, max_nodes);
        const topIds = new Set(topNodes.map(n => n.id));

        const edges = graph_json.edges.filter(e => topIds.has(e.source) && topIds.has(e.target));

        const connected = new Set();
        edges.forEach(e => {
            connected.add(e.source);
            connected.add(e.target);
        });

        const filteredNodes = topNodes.filter(n => connected.has(n.id));

        return this.calculateMeasures({
            pattern: graph_json.pattern,
            nodes: filteredNodes,
            edges: edges
        });
    }

    /* ------------------------- FULL PIPELINE ------------------------------ */

    run(text, pattern, stopwords, maxNodes) {
        this.textPrep0(text);
        this.extractPairs(pattern, stopwords);
        const filtered = this.filterGraph(this.graph_json, maxNodes);
        return filtered;
    }
}

// ========= PHRASE NET INSTANCE ==========
const phraseNet = new PhraseNet();

// --------------------------
// Element references
// --------------------------
const stopwordInput = document.getElementById("stopword-input");
const stopwordList = document.getElementById("stopword-list");
const addStopwordBtn = document.getElementById("add-stopword");
const generateBtn = document.getElementById("generate");
const useExampleBtn = document.getElementById("use-example-text");
const errorMsg = document.getElementById("error-msg");

const EXAMPLE_TEXT = `In the beginning God created the heavens and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters. And God said, Let there be light: and there was light. And God saw the light, that it was good: and God divided the light from the darkness. And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.

And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters. And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so. And God called the firmament Heaven. And the evening and the morning were the second day.

And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so. And God called the dry land Earth; and the gathering together of the waters called he Seas: and God saw that it was good. And God said, Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind, whose seed is in itself, upon the earth: and it was so. And the earth brought forth grass, and herb yielding seed after his kind, and the tree yielding fruit, whose seed was in itself, after his kind: and God saw that it was good. And the evening and the morning were the third day.

And God said, Let there be lights in the firmament of the heaven to divide the day from the night; and let them be for signs, and for seasons, and for days, and years: and let them be for lights in the firmament of the heaven to give light upon the earth: and it was so. And God made two great lights; the greater light to rule the day, and the lesser light to rule the night: he made the stars also. And God set them in the firmament of the heaven to give light upon the earth, and to rule over the day and over the night, and to divide the light from the darkness: and God saw that it was good. And the evening and the morning were the fourth day.

And God said, Let the waters bring forth abundantly the moving creature that hath life, and let fowl fly above the earth in the open firmament of heaven. And God created great whales, and every living creature that moveth, which the waters brought forth abundantly, after their kind, and every winged fowl after his kind: and God saw that it was good. And God blessed them, saying, Be fruitful, and multiply, and fill the waters in the seas, and let fowl multiply in the earth. And the evening and the morning were the fifth day.

And God said, Let the earth bring forth the living creature after his kind, cattle, and creeping thing, and beast of the earth after his kind: and it was so. And God made the beast of the earth after his kind, and cattle after their kind, and every thing that creepeth upon the earth after his kind: and God saw that it was good.

And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth, and over every creeping thing that creepeth upon the earth. So God created man in his own image, in the image of God created he him; male and female created he them. And God blessed them, and God said unto them, Be fruitful, and multiply, and replenish the earth, and subdue it: and have dominion over the fish of the sea, and over the fowl of the air, and over every living thing that moveth upon the earth. And God said, Behold, I have given you every herb bearing seed, which is upon the face of all the earth, and every tree, in which is the fruit of a tree yielding seed; to you it shall be for meat. And to every beast of the earth, and to every fowl of the air, and to every thing that creepeth upon the earth, wherein there is life, I have given every green herb for meat: and it was so. And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day.`;

let stopwords = [];
let lastGraphData = null;

const workspacePanel = document.querySelector(".workspace-panel");

function setWorkspaceVisible(visible) {
    if (!workspacePanel) return;
    workspacePanel.classList.toggle("is-visible", visible);
}

const metricNodes = document.getElementById("metric-nodes");
const metricEdges = document.getElementById("metric-edges");
const metricPattern = document.getElementById("metric-pattern");
const metricStopwords = document.getElementById("metric-stopwords");
const nodeDetails = document.getElementById("node-details");
const patternSelect = document.getElementById("pattern");
const inputText = document.getElementById("input-text");

function updateSummaryMetrics({ nodes = [], edges = [] }) {
    metricNodes.textContent = String(nodes.length || 0);
    metricEdges.textContent = String(edges.length || 0);
    metricPattern.textContent = patternSelect.value.trim() || "—";
    metricStopwords.textContent = String(stopwords.length || 0);
}

function updateAnalyzeButtonState() {
    const hasPattern = !!patternSelect.value.trim();
    const hasText = !!inputText.value.trim();
    const isReady = hasPattern && hasText;

    generateBtn.classList.toggle("ready", isReady);
    generateBtn.title = isReady ? "Analyze the text" : "Select a pattern and type text to enable analysis";
    generateBtn.textContent = isReady ? "Analyze text" : "Select pattern and text";
}

function clearNodeDetails() {
    if (!nodeDetails) return;
    nodeDetails.innerHTML = "<h3>Selected node</h3><p>Click a node in the graph to inspect it.</p>";
}

function updateNodeDetails(node) {
    if (!nodeDetails || !node) {
        clearNodeDetails();
        return;
    }

    const ratioValue = typeof node.ratio === "number" ? node.ratio : 0;
    nodeDetails.innerHTML = `
        <h3>${node.id}</h3>
        <dl>
            <dt>Weight</dt><dd>${node.weight ?? 0}</dd>
            <dt>Out</dt><dd>${node.outdegree ?? 0}</dd>
            <dt>In</dt><dd>${node.indegree ?? 0}</dd>
            <dt>Ratio</dt><dd>${ratioValue.toFixed(2)}</dd>
        </dl>
    `;
}

patternSelect.addEventListener("change", updateAnalyzeButtonState);
inputText.addEventListener("input", updateAnalyzeButtonState);

// --------------------------
// STOPWORDS
// --------------------------
function updateStopwordButtonState() {
    const value = stopwordInput.value.trim();
    const duplicate = stopwords.includes(value);
    const canAdd = !!value && !duplicate;

    addStopwordBtn.classList.toggle("ready", canAdd);
    addStopwordBtn.textContent = canAdd ? "Add stopword" : "Add";
}

addStopwordBtn.addEventListener("click", () => {
    const value = stopwordInput.value.trim();
    if (!value) return;

    if (!stopwords.includes(value)) {
        stopwords.push(value);
        updateStopwordList();
    }

    stopwordInput.value = "";
    updateStopwordButtonState();
});

if (useExampleBtn) {
    useExampleBtn.addEventListener("click", () => {
        inputText.value = EXAMPLE_TEXT;
        errorMsg.textContent = "";
        updateAnalyzeButtonState();
        inputText.focus();
    });
}

stopwordInput.addEventListener("input", updateStopwordButtonState);
stopwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addStopwordBtn.click();
    }
});

function updateStopwordList() {
    stopwordList.innerHTML = "";
    stopwords.forEach((sw, index) => {
        const li = document.createElement("li");
        li.textContent = sw;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.className = "remove-stopword";
        removeBtn.onclick = () => {
            stopwords.splice(index, 1);
            updateStopwordList();
        };

        li.appendChild(removeBtn);
        stopwordList.appendChild(li);
    });
}

// --------------------------
// MAIN BUTTON
// --------------------------
generateBtn.addEventListener("click", () => {
    const pattern = patternSelect.value.trim();
    const maxNodes = parseInt(document.getElementById("max-nodes").value);
    const textValue = inputText.value.trim();

    if (!pattern || !textValue) {
        errorMsg.textContent = "Error: pattern and text are required.";
        setWorkspaceVisible(false);
        return;
    }

    errorMsg.textContent = "";

    const params = {
        pattern,
        stopwords,
        maxNodes,
        text: textValue,
    };

    const graphData = prepareGraphData(params);
    setWorkspaceVisible(true);
    renderGraph(graphData);
});

setWorkspaceVisible(false);
updateAnalyzeButtonState();
updateStopwordButtonState();

const graphPlaceholder = document.getElementById("graph-placeholder");
if (graphPlaceholder && "ResizeObserver" in window) {
    const graphResizeObserver = new ResizeObserver(() => {
        if (!lastGraphData || !graphPlaceholder.clientWidth || !graphPlaceholder.clientHeight) return;

        const pattern = patternSelect.value.trim();
        const textValue = inputText.value.trim();
        if (!pattern || !textValue) return;

        const graphData = prepareGraphData({
            pattern,
            stopwords,
            maxNodes: parseInt(document.getElementById("max-nodes").value, 10) || 20,
            text: textValue,
        });

        renderGraph(graphData);
    });

    graphResizeObserver.observe(graphPlaceholder);
}

// --------------------------
// DATA PREPARATION
// --------------------------
function prepareGraphData({ pattern, stopwords, maxNodes, text }) {
    const result = phraseNet.run(text, pattern, stopwords, maxNodes);
    return result;
}

// --------------------------
// GRAPH RENDERING (D3)
// --------------------------
// ============================================================
// renderGraph com refinamento (stress-like) e overlap-reduction
// ============================================================
function renderGraph({ nodes, edges }) {
    lastGraphData = { nodes, edges };

    // container reset
    const container = d3.select("#graph-placeholder");
    container.html("");

    // safety
    if (!nodes || nodes.length === 0) {
        container.html("<p style='color:#999; text-align:center; padding-top:40px;'>No results for this pattern.</p>");
        clearNodeDetails();
        updateSummaryMetrics({ nodes: [], edges: [] });
        return;
    }
    if (!edges) edges = [];

    clearNodeDetails();
    updateSummaryMetrics({ nodes, edges });

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("overflow", "visible");

    // tooltip
    let tooltip = d3.select("#tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("id", "tooltip")
            .attr("class", "pn-tooltip")
            .style("opacity", 0);
    }

    // ---------------------------
    // Dynamic Arrowhead Design
    // ---------------------------
    const defs = svg.append("defs");

    // Create a single generic marker path that can be scaled
    defs.append("marker")
        .attr("id", "dynamic-arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 9) 
        .attr("refY", 5)
        .attr("markerUnits", "userSpaceOnUse") // scales relative to stroke-width
        .attr("markerWidth", 8) 
        .attr("markerHeight", 8) 
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z") // A simple triangle path
        .attr("fill", "#cccccc");

    // -----------------------------
    // Normalize color scale for shown nodes (heatmap: light -> dark)
    // -----------------------------
    const ratioVals = nodes.map(n => (n.ratio != null ? n.ratio : 0));
    const ratioMin = d3.min(ratioVals);
    const ratioMax = d3.max(ratioVals);
    // guard: if single value, avoid domain collapse
    const colorDomain = (ratioMin === ratioMax) ? [ratioMin - 1, ratioMax + 1] : [ratioMin, ratioMax];
    const colorScale = d3.scaleLinear()
        .domain(colorDomain)
        .range(["#b7d8f7", "#08306b"]);

    // -----------------------------
    // Node size and edge width scales
    // -----------------------------
    const nodeWeights = nodes.map(n => n.weight != null ? n.weight : 1);
    const nodeMin = d3.min(nodeWeights), nodeMax = d3.max(nodeWeights);
    const nodeDomain = (nodeMin === nodeMax) ? [nodeMin === 0 ? 1 : nodeMin, nodeMax + 1] : [nodeMin, nodeMax];
    const sizeScale = d3.scaleLinear().domain(nodeDomain).range([12, 36]);

    const edgeWeights = edges.map(e => e.weight != null ? e.weight : 1);
    const edgeMin = edgeWeights.length ? d3.min(edgeWeights) : 1;
    const edgeMax = edgeWeights.length ? d3.max(edgeWeights) : 1;
    const edgeDomain = (edgeMin === edgeMax) ? [edgeMin === 0 ? 1 : edgeMin, edgeMax + 1] : [edgeMin, edgeMax];
    // Use sqrt mapping for width perceptual scaling
    const edgeWidthScale = d3.scaleSqrt().domain(edgeDomain).range([1, 6]);

    // -----------------------------
    // Compute average degree / density to adapt forces
    // -----------------------------
    const avgDegree = nodes.length ? (edges.length / nodes.length) : 0; // average out-degree
    // adapt parameters: more edges -> increase link distance and repulsion
    const baseLinkDistance = Math.max(60, Math.min(220, 60 + 30 * avgDegree)); // adaptative
    const chargeStrength = -80 - Math.min(600, Math.round(40 * avgDegree)); // more negative if dense
    const collideStrength = 1.0;

    // helper normalize src/dst
    const normSrc = e => (typeof e.source === "string") ? e.source : (e.source && e.source.id ? e.source.id : "");
    const normDst = e => (typeof e.target === "string") ? e.target : (e.target && e.target.id ? e.target.id : "");

    // parallel counts
    const parallelCount = {};
    edges.forEach(e => {
        const k = `${normSrc(e)}:::${normDst(e)}`;
        parallelCount[k] = (parallelCount[k] || 0) + 1;
    });

    // ---------------------------------------------------
    // NOVO: Estrutura para Destaque de Vizinhança
    // Deve ser preenchida antes da simulação iniciar, mas a resolução 
    // de source/target para objetos ocorre logo após o d3.forceLink.
    // Usaremos normSrc/normDst para preencher inicialmente com IDs.
    // ---------------------------------------------------
    const neighbors = {};
    const linkedByIndex = {};

    edges.forEach(d => {
        const srcId = normSrc(d);
        const dstId = normDst(d);

        // Mapeamento de vizinhos por ID (bidirecional)
        neighbors[srcId] = neighbors[srcId] || [];
        neighbors[dstId] = neighbors[dstId] || [];
        // Adiciona se não existir (evita duplicidade em links paralelos)
        if (!neighbors[srcId].includes(dstId)) neighbors[srcId].push(dstId);
        if (!neighbors[dstId].includes(srcId)) neighbors[dstId].push(srcId);
        
        // Mapeamento de links por par de nós
        linkedByIndex[`${srcId},${dstId}`] = 1;
        linkedByIndex[`${dstId},${srcId}`] = 1;
    });

    // Função de verificação de link
    function isConnected(a, b) {
        const aId = (typeof a === 'string') ? a : a.id;
        const bId = (typeof b === 'string') ? b : b.id;
        return linkedByIndex[`${aId},${bId}`] === 1;
    }
    // ---------------------------------------------------

    // Phase: initial seeding to avoid collapse
    const seedSim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges).id(d => d.id).distance(baseLinkDistance * 0.75))
        .force("charge", d3.forceManyBody().strength(chargeStrength * 0.6))
        .force("center", d3.forceCenter(width/2, height/2))
        .stop();
    for (let i = 0; i < 140; i++) seedSim.tick();

    // Measure labels to compute radii
    const meas = svg.append("g").selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .text(d => d.id)
        .style("font-size", d => sizeScale(d.weight) + "px")
        .style("font-family", "'Inter Tight', 'Roboto Condensed', sans-serif")
        .style("visibility", "hidden");

    meas.nodes().forEach((el, i) => {
        const bb = el.getBBox();
        nodes[i]._labelW = bb.width;
        nodes[i]._labelH = bb.height;
        nodes[i]._r = Math.sqrt(bb.width*bb.width + bb.height*bb.height)/2 + 4;
    });
    meas.remove();

    // containment helper
    function contain(node, margin = 6) {
        node.x = Math.max(margin + node._labelW/2, Math.min(width - margin - node._labelW/2, node.x));
        node.y = Math.max(margin + node._labelH/2, Math.min(height - margin - node._labelH/2, node.y));
    }

    // refined link force: distance grows slightly with labels to avoid overlap
    const linkForce = d3.forceLink(edges).id(d => d.id)
        .distance(d => {
            const a = (d.source && d.source._labelW) ? d.source._labelW : 24;
            const b = (d.target && d.target._labelW) ? d.target._labelW : 24;
            return Math.max(baseLinkDistance, (a + b) * 0.6);
        })
        .strength(0.9);

    const sim = d3.forceSimulation(nodes)
        .force("link", linkForce)
        .force("charge", d3.forceManyBody().strength(chargeStrength))
        .force("center", d3.forceCenter(width/2, height/2))
        .force("collide", d3.forceCollide(d => d._r).iterations(1).strength(collideStrength))
        .alpha(0.9)
        .alphaDecay(0.02);

    // ---------------------------------------------------
    // NOVO: Função para Destaque de Vizinhança
    // ---------------------------------------------------
    let activeNode = null; // Para rastrear o nó atualmente clicado

    function highlightGraph(d) {
        if (activeNode && activeNode.id === d.id) {
            // Se clicou no mesmo nó, desliga o destaque
            activeNode = null;
        } else {
            // Liga o destaque
            activeNode = d;
        }

        // --- Aplicar estilos ---
        
        // Arestas: Reduzir opacidade de tudo
        link.attr("opacity", activeNode ? 0.1 : 0.95)
            .attr("stroke", "#cccccc"); // Reset cor
        
        // Arestas: Destacar arestas conectadas
        link.filter(e => activeNode && (e.source.id === activeNode.id || e.target.id === activeNode.id))
            .attr("opacity", 0.8)
            .attr("stroke", "#444444"); // Cor de destaque para arestas

        // Nós (Labels): Reduzir opacidade de tudo
        label.attr("opacity", activeNode ? 0.2 : 1.0);
        
        // Nós (Labels): Destacar nó clicado e vizinhos
        label.filter(n => {
            if (!activeNode) return true; // Mostrar todos se reset
            
            // É o nó clicado OU está na lista de vizinhos (de primeiro grau)
            const isNeighbor = (neighbors[activeNode.id] && neighbors[activeNode.id].includes(n.id));
            return (n.id === activeNode.id || isNeighbor);

        }).attr("opacity", 1.0);
    }
    // ---------------------------------------------------
        
    // create curved link paths
    const link = svg.append("g").attr("class","links")
        .selectAll("path")
        .data(edges)
        .enter()
        .append("path")
        .attr("fill","none")
        .attr("stroke","#cccccc")
        .attr("stroke-width", d => edgeWidthScale(d.weight))
        .attr("marker-end", "url(#dynamic-arrow)") // Use the generic marker
        .attr("opacity", 0.95)
        // Dynamically set marker dimensions based on line width for proportional look
        .each(function(d) {
            const w = edgeWidthScale(d.weight); // Stroke width (1 to 6)
            // Seta terá um tamanho baseado na largura da linha, com limites
            const markerSize = Math.min(Math.max(w * 1.5, 3), 10); // Min 3, Max 10
            const refX = markerSize + 1.5; // Ajuste para que a ponta toque o alvo (mais controle)

            d3.select(this)
                .attr("marker-end", `url(#dynamic-arrow)`)
                .attr("markerWidth", markerSize)
                .attr("markerHeight", markerSize)
                .attr("refX", refX);
        });

    // labels as text nodes
    const label = svg.append("g").attr("class","labels")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .text(d => d.id)
        .style("font-size", d => sizeScale(d.weight) + "px")
        .style("font-family", "'Inter Tight', 'Roboto Condensed', sans-serif")
        .style("fill", d => colorScale(d.ratio != null ? d.ratio : 0))
        .attr("text-anchor","middle")
        .style("dominant-baseline","middle")
        .style("pointer-events","all")
        .call(d3.drag()
            .on("start", (ev,d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on("drag", (ev,d) => { d.fx = ev.x; d.fy = ev.y; })
            .on("end", (ev,d) => { if (!ev.active) sim.alphaTarget(0); d.fx = d.x; d.fy = d.y; })
        )
        // NOVO: Evento de clique para destaque
        .on("click", (ev, d) => {
            highlightGraph(d);
            updateNodeDetails(d);
        });

    // tooltip interaction
    label.on("mouseover", (ev,d) => {
        tooltip.style("opacity",1)
               .html(`<strong>${d.id}</strong><br>weight: ${d.weight}<br>out: ${d.outdegree}<br>in: ${d.indegree}<br>ratio: ${(d.ratio||0).toFixed(2)}`);
    }).on("mousemove",(ev) => {
        tooltip.style("left",(ev.pageX + 12) + "px").style("top",(ev.pageY + 12) + "px");
    }).on("mouseout", () => tooltip.style("opacity",0));

    // tick
    sim.on("tick", () => {
        // containment
        nodes.forEach(n => contain(n, 6));

        // recompute parallel indices
        const pairIndex = {};
        edges.forEach(e => {
            const s = normSrc(e), t = normDst(e);
            const key = `${s}:::${t}`;
            pairIndex[key] = (pairIndex[key] || 0) + 1;
            e._parallelIndex = pairIndex[key];
            e._parallelTotal = parallelCount[key] || 1;
        });

        // draw curved links; arrow endpoint stops before label using target._r
        link.attr("d", d => {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            const idx = d._parallelIndex || 1;
            const tot = d._parallelTotal || 1;
            const sign = (idx % 2 === 0) ? -1 : 1;
            const offset = (6 + idx * 8) * sign * (tot > 1 ? 1 : Math.min(1, dist/120));
            const mx = (sx + tx)/2, my = (sy + ty)/2;
            const nx = -dy/dist, ny = dx/dist;
            const cx = mx + nx * offset, cy = my + ny * offset;
            
            // NOVO: Ajuste para aproximar a seta (targetR + 1)
            const targetR = d.target._r || 8;
            const endOffsetX = (dx / dist) * (targetR + 1); // <-- MUDANÇA AQUI (era + 4)
            const endOffsetY = (dy / dist) * (targetR + 1); // <-- MUDANÇA AQUI (era + 4)
            const txAdj = tx - endOffsetX;
            const tyAdj = ty - endOffsetY;
            return `M ${sx},${sy} Q ${cx},${cy} ${txAdj},${tyAdj}`;
        });

        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    // final relax pass on end
    sim.on("end", () => {
        // small iterative overlap relax (cheap)
        let moved=true, it=0;
        while (moved && it++ < 80) {
            moved=false;
            for (let i=0;i<nodes.length;i++){
                for (let j=i+1;j<nodes.length;j++){
                    const a = nodes[i], b = nodes[j];
                    const ax1 = a.x - a._labelW/2 - 4, ax2 = a.x + a._labelW/2 + 4;
                    const ay1 = a.y - a._labelH/2 - 4, ay2 = a.y + a._labelH/2 + 4;
                    const bx1 = b.x - b._labelW/2 - 4, bx2 = b.x + b._labelW/2 + 4;
                    const by1 = b.y - b._labelH/2 - 4, by2 = b.y + b._labelH/2 + 4;
                    if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
                        const vx = a.x - b.x || (Math.random()-0.5)*0.01;
                        const vy = a.y - b.y || (Math.random()-0.5)*0.01;
                        const vlen = Math.sqrt(vx*vx + vy*vy) || 1;
                        const shift = 1.2;
                        a.x += (vx/vlen)*shift; a.y += (vy/vlen)*shift;
                        b.x -= (vx/vlen)*shift; b.y -= (vy/vlen)*shift;
                        moved=true;
                    }
                }
            }
        }
        nodes.forEach(n => contain(n,6));
        label.attr("x", d => d.x).attr("y", d => d.y);
        link.attr("d", d => {
            const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
            const dx = tx-sx, dy = ty-sy; const dist = Math.sqrt(dx*dx+dy*dy)||1;
            const idx = d._parallelIndex||1; const tot = d._parallelTotal||1;
            const sign = (idx%2===0)?-1:1;
            const offset = (6 + idx*8)*sign*(tot>1 ? 1 : Math.min(1, dist/120));
            const mx=(sx+tx)/2,my=(sy+ty)/2; const nx=-dy/dist, ny=dx/dist;
            const cx = mx + nx*offset, cy = my + ny*offset;
            
            // NOVO: Ajuste para aproximar a seta (targetR + 1)
            const targetR = d.target._r || 8;
            const endOffsetX = (dx / dist) * (targetR + 1); // <-- MUDANÇA AQUI (era + 4)
            const endOffsetY = (dy / dist) * (targetR + 1); // <-- MUDANÇA AQUI (era + 4)
            const txAdj = tx - endOffsetX, tyAdj = ty - endOffsetY;
            return `M ${sx},${sy} Q ${cx},${cy} ${txAdj},${tyAdj}`;
        });
    });
}

