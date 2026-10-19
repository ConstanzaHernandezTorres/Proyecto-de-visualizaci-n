/**
 * VISUALIZACIÓN: ¿DÓNDE SE ENCUENTRAN LAS MAYORES AMENAZAS VOLCÁNICAS EN SUDAMÉRICA?
 * InfoVis IIC2026 PUC
 * 
 * - Enfoque explicativo directo (Cápsulas 17 y 18):
 *   Responde la pregunta en el primer segundo sin necesidad de interactuar.
 * - Algoritmo anti-solapamiento (Zero Overlap):
 *   Separación física de marcas adyacentes con líneas de guía al cráter exacto.
 * - Sonificación multicanal en Tone.js (Cápsula 23):
 *   Subgraves sísmicos según VEI y ritmo cardíaco según población a 10 km.
 */

const state = {
  volcanoes: [],
  worldData: null,
  activeRadius: 'pop_10km',
  selectedVolcano: null,
  threatNodes: []
};

const colorScale = d3.scaleSequential()
  .domain([0, 7])
  .interpolator(d3.interpolateYlOrRd);

let svg, gRoot, gMap, gLeaders, gWaves, gVolcanoes, gLabels, projection, pathGen, zoomBehavior;
const tooltip = d3.select('#tooltip');

document.addEventListener('DOMContentLoaded', async () => {
  setupUIEvents();
  setupAudioVisualizer();
  await loadData();
  initVisualization();
  selectDefaultVolcano();
});

async function loadData() {
  try {
    const [volcanoesRes, worldRes] = await Promise.all([
      d3.json('data/volcanoes.json'),
      d3.json('data/world-110m.json')
    ]);
    state.volcanoes = volcanoesRes;
    state.worldData = worldRes;
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function setupUIEvents() {
  // Inicialización de audio al primer clic en la pantalla
  document.getElementById('viz-stage').addEventListener('click', () => {
    if (!window.volcanoAudio.isInitialized) {
      window.volcanoAudio.init().then(enabled => updateAudioUI(enabled));
    }
  }, { once: true });

  // Botón de re-sonificación en la ficha
  const resoundBtn = document.getElementById('btn-resound');
  if (resoundBtn) {
    resoundBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!window.volcanoAudio.isInitialized) {
        await window.volcanoAudio.init();
      }
      if (state.selectedVolcano) {
        triggerConcentricWaves(state.selectedVolcano);
        window.volcanoAudio.sonifyVolcano(state.selectedVolcano, state.activeRadius);
      }
    });
  }

  // Controles de zoom
  document.getElementById('btn-zoom-in').addEventListener('click', (e) => {
    e.stopPropagation();
    if (zoomBehavior) svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.4);
  });

  document.getElementById('btn-zoom-out').addEventListener('click', (e) => {
    e.stopPropagation();
    if (zoomBehavior) svg.transition().duration(250).call(zoomBehavior.scaleBy, 0.71);
  });

  document.getElementById('btn-zoom-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    if (zoomBehavior) svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity);
  });
}

function updateAudioUI(enabled) {
  const resoundBtn = document.getElementById('btn-resound');
  if (resoundBtn && enabled) {
    resoundBtn.classList.add('ready');
  }
}

function initVisualization() {
  const container = document.getElementById('viz-stage');
  const width = container.clientWidth || 1000;
  const height = container.clientHeight || 750;

  svg = d3.select('#viz-svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  gRoot = svg.append('g').attr('class', 'root-g');
  gMap = gRoot.append('g').attr('class', 'map-g');
  gLeaders = gRoot.append('g').attr('class', 'leaders-g');
  gWaves = gRoot.append('g').attr('class', 'waves-g');
  gVolcanoes = gRoot.append('g').attr('class', 'volcanoes-g');
  gLabels = gRoot.append('g').attr('class', 'labels-g');

  // Zoom interactivo configurado ANTES de cualquier llamada
  zoomBehavior = d3.zoom()
    .scaleExtent([0.8, 16])
    .on('start', () => {
      tooltip.style('opacity', 0);
    })
    .on('zoom', (event) => {
      gRoot.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);

  // Proyección cartográfica centrada en Sudamérica y ajustada a la Cordillera de los Andes
  // Centro: longitud -66°, latitud -24°
  projection = d3.geoMercator()
    .center([-66, -24])
    .scale(height * 0.84)
    .translate([width / 2, height / 2]);

  pathGen = d3.geoPath().projection(projection);

  // 1. Cuadrícula sutil
  const graticule = d3.geoGraticule();
  gMap.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', pathGen);

  // 2. Mapa físico de países
  if (state.worldData) {
    const countries = topojson.feature(state.worldData, state.worldData.objects.countries);
    gMap.append('g')
      .attr('class', 'countries-layer')
      .selectAll('path')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('class', 'land')
      .attr('d', pathGen);
  }

  // 3. Renderizar las amenazas de Sudamérica con algoritmo anti-solapamiento
  renderSouthAmericaThreats();
}

/**
 * Filtra las 39 amenazas mayores de Sudamérica y resuelve completamente el solapamiento
 */
function renderSouthAmericaThreats() {
  // Filtrar estrictamente a las amenazas mayores de Sudamérica:
  // Volcanes con VEI >= 4 O población en evacuación (10 km) >= 10.000 hab.
  const saThreats = state.volcanoes.filter(v => 
    v.region === 'South America' && 
    (v.max_vei >= 4 || (v.pop_10km || 0) >= 10000)
  );

  // Crear nodos con coordenadas proyectadas y radio
  const nodes = saThreats.map(d => {
    const p = projection([d.lon, d.lat]);
    const pop = d.pop_10km || 0;
    // Escala perceptualmente calibrada para no saturar
    const r = Math.max(5.5, Math.min(18, 4.5 + Math.log10(pop + 1) * 2.3));
    return {
      data: d,
      id: d.id,
      name: d.name,
      country: d.country,
      vei: d.max_vei,
      pop10k: pop,
      origX: p ? p[0] : 0,
      origY: p ? p[1] : 0,
      x: p ? p[0] : 0,
      y: p ? p[1] : 0,
      r: r
    };
  });

  // ALGORITMO DE SEPARACIÓN (ANTI-SOLAPAMIENTO):
  // Itera relajando colisiones entre círculos cercanos para que la distancia >= r1 + r2 + 4px
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r + 4; // 4px de separación mínima garantizada

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          // Puje preferentemente horizontal (Este-Oeste) para preservar la correspondencia latitudinal
          const angle = Math.atan2(dy, dx);
          const pushFactor = overlap * 0.52;
          const px = Math.cos(angle) * pushFactor;
          const py = Math.sin(angle) * pushFactor * 0.35; // menor desplazamiento vertical

          a.x -= px;
          a.y -= py;
          b.x += px;
          b.y += py;
        }
      }
    }
  }

  state.threatNodes = nodes;

  // 1. Dibujar líneas guía (leader lines) y puntos de anclaje para marcas desplazadas
  gLeaders.selectAll('*').remove();

  nodes.forEach(n => {
    const displacement = Math.hypot(n.x - n.origX, n.y - n.origY);
    if (displacement > 2.5) {
      // Línea punteada que conecta el círculo con el cráter físico
      gLeaders.append('line')
        .attr('class', 'volcano-leader')
        .attr('x1', n.origX)
        .attr('y1', n.origY)
        .attr('x2', n.x)
        .attr('y2', n.y);

      // Pequeño punto de anclaje en el cráter físico
      gLeaders.append('circle')
        .attr('class', 'volcano-anchor')
        .attr('cx', n.origX)
        .attr('cy', n.origY)
        .attr('r', 1.8);
    }
  });

  // 2. Dibujar las marcas de volcanes (orden descendente de tamaño para que los pequeños queden encima)
  const sortedNodes = [...nodes].sort((a, b) => b.r - a.r);

  const marks = gVolcanoes.selectAll('.volcano-mark')
    .data(sortedNodes, d => d.id);

  marks.exit().remove();

  const enter = marks.enter()
    .append('circle')
    .attr('class', 'volcano-mark')
    .attr('id', d => `v-mark-${d.id}`)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 0)
    .style('opacity', 0)
    .on('mouseenter', (event, d) => onVolcanoHover(event, d.data))
    .on('mouseleave', () => onVolcanoLeave())
    .on('click', (event, d) => onVolcanoSelect(d.data));

  marks.merge(enter)
    .transition()
    .duration(500)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', d => d.r)
    .style('fill', d => colorScale(d.vei))
    .style('stroke', '#0e0d0c')
    .style('stroke-width', '1.1px')
    .style('opacity', 0.88);

  // 3. Etiquetas visuales directas para responder el mensaje de inmediato (sin interactuar)
  renderDirectLabels(nodes);
}

/**
 * Rótulos directos sobre los volcanes más emblemáticos (visibles de entrada)
 */
function renderDirectLabels(nodes) {
  gLabels.selectAll('*').remove();

  // Selección de los casos más relevantes para rotular directamente
  const highlightedNames = [
    'Pululahua',
    'Galeras',
    'Ruiz',
    'Villarrica',
    'Calbuco',
    'Hudson'
  ];

  nodes.forEach(n => {
    const isHighlighted = highlightedNames.some(name => n.name.includes(name));
    if (isHighlighted) {
      // Posicionar la etiqueta ligeramente a la izquierda o derecha
      const isRight = n.x >= (projection.translate()[0] || 500);
      const textX = isRight ? n.x + n.r + 5 : n.x - n.r - 5;
      const textAnchor = isRight ? 'start' : 'end';

      let shortLabel = n.name;
      if (n.name.includes('Pululahua')) shortLabel = 'Pululahua (534k hab · VEI 5)';
      else if (n.name.includes('Galeras')) shortLabel = 'Galeras (121k hab · VEI 3)';
      else if (n.name.includes('Ruiz')) shortLabel = 'Nevado del Ruiz (20k · Armero)';
      else if (n.name.includes('Villarrica')) shortLabel = 'Villarrica (VEI 5 · Chile)';
      else if (n.name.includes('Calbuco')) shortLabel = 'Calbuco (VEI 5 · Chile)';
      else if (n.name.includes('Hudson')) shortLabel = 'Cerro Hudson (VEI 6 · Chile)';

      gLabels.append('text')
        .attr('class', 'volcano-direct-label')
        .attr('x', textX)
        .attr('y', n.y + 3)
        .attr('text-anchor', textAnchor)
        .text(shortLabel);
    }
  });
}

function onVolcanoHover(event, d) {
  if (state.selectedVolcano && state.selectedVolcano.id === d.id) {
    tooltip.style('opacity', 0);
    return;
  }

  d3.select(`#v-mark-${d.id}`)
    .classed('hovered', true)
    .raise();

  window.volcanoAudio.playHoverTick();

  const pop10 = (d.pop_10km || 0).toLocaleString();

  tooltip.html(`
    <div class="tooltip-title">${d.name}</div>
    <div class="tooltip-line"><span class="tooltip-dim">País:</span> <span>${d.country}</span></div>
    <div class="tooltip-line"><span class="tooltip-dim">Explosividad:</span> <span>VEI ${d.max_vei}</span></div>
    <div class="tooltip-line"><span class="tooltip-dim">Evacuación (10 km):</span> <span>${pop10} hab.</span></div>
  `)
  .style('left', `${event.pageX + 12}px`)
  .style('top', `${event.pageY - 16}px`)
  .style('opacity', 1);
}

function onVolcanoLeave() {
  d3.selectAll('.volcano-mark').classed('hovered', false);
  tooltip.style('opacity', 0);
}

async function onVolcanoSelect(d) {
  state.selectedVolcano = d;

  tooltip.style('opacity', 0);
  d3.selectAll('.volcano-mark').classed('hovered', false);
  d3.selectAll('.volcano-mark').classed('selected', false);

  d3.select(`#v-mark-${d.id}`).classed('selected', true).raise();

  // Enfocar suavemente con zoom
  const p = projection([d.lon, d.lat]);
  if (p && zoomBehavior) {
    const stage = document.getElementById('viz-stage');
    const w = stage.clientWidth || 1000;
    const h = stage.clientHeight || 750;
    svg.transition().duration(650).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(w / 2 - p[0] * 3, h / 2 - p[1] * 3).scale(3)
    );
  }

  triggerConcentricWaves(d);
  renderInspectorCard(d);

  if (!window.volcanoAudio.isInitialized) {
    await window.volcanoAudio.init();
    updateAudioUI(true);
  }

  window.volcanoAudio.sonifyVolcano(d, 'pop_10km');
}

function triggerConcentricWaves(d) {
  // Buscar nodo correspondiente para usar sus coordenadas
  const node = state.threatNodes.find(n => n.id === d.id);
  const cx = node ? node.x : (projection([d.lon, d.lat]) || [0, 0])[0];
  const cy = node ? node.y : (projection([d.lon, d.lat]) || [0, 0])[1];

  gWaves.selectAll('*').remove();

  [1, 2, 3].forEach((idx) => {
    gWaves.append('circle')
      .attr('class', 'concentric-wave')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', node ? node.r : 5)
      .style('opacity', 0.95)
      .transition()
      .delay(idx * 140)
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('r', (node ? node.r : 5) + 24 + idx * 22)
      .style('opacity', 0)
      .remove();
  });
}

function renderInspectorCard(d) {
  const elTitle = document.getElementById('det-title');
  const elCountry = document.getElementById('det-country');
  const elVei = document.getElementById('det-vei');
  const elPop = document.getElementById('det-pop');
  const elBadge = document.getElementById('det-badge');

  if (elTitle) elTitle.textContent = d.name;
  if (elCountry) elCountry.textContent = d.country;
  if (elVei) elVei.textContent = `VEI ${d.max_vei}`;
  if (elPop) elPop.textContent = `${(d.pop_10km || 0).toLocaleString()} hab.`;

  if (elBadge) {
    const pop = d.pop_10km || 0;
    const vei = d.max_vei || 0;
    if (vei >= 4 && pop >= 10000) {
      elBadge.textContent = '🚨 RIESGO CRÍTICO';
      elBadge.className = 'ins-badge badge-critical';
    } else if (vei >= 4) {
      elBadge.textContent = '💥 ALTA EXPLOSIVIDAD';
      elBadge.className = 'ins-badge badge-elevated';
    } else {
      elBadge.textContent = '🟡 DENSIDAD URBANA';
      elBadge.className = 'ins-badge badge-moderate';
    }
  }
}

function selectDefaultVolcano() {
  const defaultV = state.volcanoes.find(v => v.name.includes('Villarrica')) || state.volcanoes[0];
  if (defaultV) {
    state.selectedVolcano = defaultV;
    renderInspectorCard(defaultV);
    d3.select(`#v-mark-${defaultV.id}`).classed('selected', true);
  }
}

function setupAudioVisualizer() {
  const canvas = document.getElementById('audio-waveform');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function renderWave() {
    requestAnimationFrame(renderWave);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const values = window.volcanoAudio.getWaveformData();
    if (!values || !window.volcanoAudio.isEnabled) {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = '#443f3b';
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#ff7700';

    const sliceWidth = canvas.width / values.length;
    let x = 0;

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const y = (v + 1) / 2 * canvas.height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  }

  renderWave();
}
