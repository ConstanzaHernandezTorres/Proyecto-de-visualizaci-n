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

  // 1. Identificar geometrías de Sudamérica para encajar y maximizar la escala
  const saIds = new Set(['032','068','076','152','170','218','238','254','328','600','604','740','858','862']);
  let saFeature = null;
  if (state.worldData && state.worldData.objects && state.worldData.objects.countries) {
    const saGeoms = state.worldData.objects.countries.geometries.filter(g => saIds.has(g.id));
    saFeature = topojson.feature(state.worldData, { type: 'GeometryCollection', geometries: saGeoms });
  }

  // 2. Proyección cartográfica centrada en Sudamérica y ajustada para ocupar el tamaño máximo
  // Dejando margen izquierdo para el panel de guía y margen derecho para la leyenda
  const leftPad = Math.max(290, Math.min(340, width * 0.26));
  const rightPad = Math.max(120, Math.min(180, width * 0.12));

  if (saFeature) {
    projection = d3.geoMercator()
      .fitExtent([[leftPad, 20], [width - rightPad, height - 25]], saFeature);
  } else {
    projection = d3.geoMercator()
      .center([-66, -24])
      .scale(height * 0.95)
      .translate([width * 0.58, height * 0.5]);
  }

  pathGen = d3.geoPath().projection(projection);

  // 3. Cuadrícula sutil
  const graticule = d3.geoGraticule();
  gMap.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', pathGen);

  // 4. Paleta tonal armonizada para diferenciar claramente los países vecinos de Sudamérica
  const countryPalette = {
    '032': '#27211c', // Argentina (tierra cálido)
    '152': '#19222c', // Chile (azul pizarra oscuro)
    '068': '#212520', // Bolivia (musgo granítico oscuro)
    '604': '#292026', // Perú (ciruela / berenjena profundo)
    '218': '#1b2723', // Ecuador (verde abeto oscuro)
    '170': '#28221d', // Colombia (café umber oscuro)
    '862': '#221e29', // Venezuela (violeta obsidiana)
    '076': '#1d231b', // Brasil (oliva bosque profundo)
    '600': '#27241b', // Paraguay (bronce ámbar oscuro)
    '858': '#1c2428', // Uruguay (azul marino pizarra)
    '328': '#1f2220', // Guyana
    '740': '#221f22', // Surinam
    '238': '#1c1f23'  // Falkland
  };

  // 5. Capa de países con colores diferenciados y respuesta interactiva
  if (state.worldData) {
    const countries = topojson.feature(state.worldData, state.worldData.objects.countries);

    gMap.append('g')
      .attr('class', 'countries-layer')
      .selectAll('path')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('class', d => saIds.has(d.id) ? 'land sa-land' : 'land other-land')
      .attr('id', d => `country-${d.id}`)
      .attr('fill', d => countryPalette[d.id] || (saIds.has(d.id) ? '#22201d' : '#141312'))
      .attr('d', pathGen)
      .on('mouseenter', (event, d) => onCountryHover(event, d))
      .on('mouseleave', () => onCountryLeave());

    // 6. Líneas divisorias de fronteras internacionales con trazo nítido (topojson.mesh)
    const saBorders = topojson.mesh(state.worldData, state.worldData.objects.countries, (a, b) => {
      return a !== b && (saIds.has(a.id) || saIds.has(b.id));
    });

    gMap.append('path')
      .datum(saBorders)
      .attr('class', 'country-border-mesh')
      .attr('d', pathGen);

    // 7. Rótulos cartográficos de países integrados sutilmente
    const labelConfigs = {
      '032': { name: 'ARGENTINA', offset: [20, 10], cls: 'label-large' },
      '152': { name: 'CHILE', offset: [-18, 25], rotate: -85 },
      '068': { name: 'BOLIVIA', offset: [10, 0] },
      '604': { name: 'PERÚ', offset: [-15, -10] },
      '218': { name: 'ECUADOR', offset: [-18, -12] },
      '170': { name: 'COLOMBIA', offset: [15, -10] },
      '862': { name: 'VENEZUELA', offset: [0, 0] },
      '076': { name: 'BRASIL', offset: [25, 0], cls: 'label-huge' },
      '600': { name: 'PARAGUAY', offset: [0, 0] },
      '858': { name: 'URUGUAY', offset: [0, 0] }
    };

    const gCountryLabels = gMap.append('g').attr('class', 'country-labels-layer');

    countries.features.filter(f => labelConfigs[f.id]).forEach(f => {
      const conf = labelConfigs[f.id];
      const pt = pathGen.centroid(f);
      if (pt && !isNaN(pt[0])) {
        const lx = pt[0] + (conf.offset ? conf.offset[0] : 0);
        const ly = pt[1] + (conf.offset ? conf.offset[1] : 0);
        const textElem = gCountryLabels.append('text')
          .attr('class', `country-label ${conf.cls || ''}`)
          .attr('id', `c-label-${f.id}`)
          .attr('x', lx)
          .attr('y', ly)
          .text(conf.name);

        if (conf.rotate) {
          textElem.attr('transform', `rotate(${conf.rotate}, ${lx}, ${ly})`);
        }
      }
    });
  }

  // 5. Renderizar las amenazas de Sudamérica con algoritmo anti-solapamiento de largo uniforme
  renderSouthAmericaThreats();
}

/**
 * Filtra las 39 amenazas mayores de Sudamérica y resuelve el solapamiento con proyección de largo uniforme
 */
function renderSouthAmericaThreats() {
  // Filtrar estrictamente a las amenazas mayores de Sudamérica:
  // Volcanes con VEI >= 4 O población en evacuación (10 km) >= 10.000 hab.
  const saThreats = state.volcanoes.filter(v => 
    v.region === 'South America' && 
    (v.max_vei >= 4 || (v.pop_10km || 0) >= 10000)
  );

  // Largo uniforme de la línea punteada para todos los volcanes proyectados (62px)
  const LINE_LEN = 62;

  // Crear nodos con coordenadas proyectadas y radio
  const nodes = saThreats.map(d => {
    const p = projection([d.lon, d.lat]);
    const pop = d.pop_10km || 0;
    // Escala perceptualmente calibrada para no saturar
    const r = Math.max(5.5, Math.min(16, 4.5 + Math.log10(pop + 1) * 2.1));
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
      r: r,
      needsProjection: false
    };
  });

  // Detectar volcanes que se solaparían si se dibujaran directamente sobre su cráter
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].origX - nodes[j].origX, nodes[i].origY - nodes[j].origY);
      if (d < nodes[i].r + nodes[j].r + 8) {
        nodes[i].needsProjection = true;
        nodes[j].needsProjection = true;
      }
    }
  }

  // Ordenar de norte a sur para inicializar abanicos ordenados
  nodes.sort((a, b) => a.origY - b.origY);

  // Inicialización de la proyección: fanning hacia el oeste (Océano Pacífico)
  // y alternancia leve para repartir los densos cúmulos de Ecuador y el sur de Chile
  nodes.forEach((n, idx) => {
    if (n.needsProjection) {
      const side = idx % 2 === 0 ? -1 : 1;
      const angle = side === -1 ? Math.PI + ((idx % 4) - 1.5) * 0.35 : ((idx % 4) - 1.5) * 0.35;
      n.x = n.origX + Math.cos(angle) * LINE_LEN;
      n.y = n.origY + Math.sin(angle) * LINE_LEN;
    }
  });

  // Relajación de colisiones con preservación estricta de largo uniforme (LINE_LEN)
  for (let iter = 0; iter < 250; iter++) {
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
          const px = (dx / dist) * overlap * 0.5;
          const py = (dy / dist) * overlap * 0.5;
          if (a.needsProjection) { a.x -= px; a.y -= py; }
          if (b.needsProjection) { b.x += px; b.y += py; }
        }
      }
    }

    // Restricción: mantener largo estrictamente idéntico (62px) para todos los proyectados
    nodes.forEach(n => {
      if (n.needsProjection) {
        const curDist = Math.hypot(n.x - n.origX, n.y - n.origY) || 1;
        n.x = n.origX + ((n.x - n.origX) / curDist) * LINE_LEN;
        n.y = n.origY + ((n.y - n.origY) / curDist) * LINE_LEN;
      }
    });
  }

  state.threatNodes = nodes;

  // 1. Dibujar líneas guía uniformes y puntos de anclaje (cráter) destacados
  gLeaders.selectAll('*').remove();

  nodes.forEach(n => {
    if (n.needsProjection) {
      // Línea punteada de largo uniforme y evidente
      gLeaders.append('line')
        .attr('class', 'volcano-leader')
        .attr('id', `leader-${n.id}`)
        .attr('x1', n.origX)
        .attr('y1', n.origY)
        .attr('x2', n.x)
        .attr('y2', n.y);

      // Símbolo de cráter físico en la cordillera (anillo exterior + núcleo)
      const anchorG = gLeaders.append('g')
        .attr('class', 'volcano-anchor-group')
        .attr('id', `anchor-${n.id}`)
        .attr('title', `${n.name} (cráter real)`)
        .on('mouseenter', (event) => onVolcanoHover(event, n.data))
        .on('mouseleave', () => onVolcanoLeave())
        .on('click', () => onVolcanoSelect(n.data));

      anchorG.append('circle')
        .attr('class', 'volcano-anchor-ring')
        .attr('cx', n.origX)
        .attr('cy', n.origY)
        .attr('r', 3.8);

      anchorG.append('circle')
        .attr('class', 'volcano-anchor-dot')
        .attr('cx', n.origX)
        .attr('cy', n.origY)
        .attr('r', 1.6);
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

  d3.select(`#v-mark-${d.id}`).classed('hovered', true).raise();
  d3.select(`#leader-${d.id}`).classed('highlighted', true);
  d3.select(`#anchor-${d.id}`).classed('highlighted', true);

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
  d3.selectAll('.volcano-leader').classed('highlighted', d => state.selectedVolcano && state.selectedVolcano.id === d?.id);
  d3.selectAll('.volcano-anchor-group').classed('highlighted', d => state.selectedVolcano && state.selectedVolcano.id === d?.id);
  tooltip.style('opacity', 0);
}

function onCountryHover(event, d) {
  if (!d.properties || !d.properties.name) return;
  // Solo mostrar tooltip de país si el cursor no está sobre un volcán
  if (d3.selectAll('.volcano-mark.hovered').empty() && !state.selectedVolcano) {
    tooltip.html(`<div class="tooltip-title" style="margin:0; font-size: 0.85rem; color: #ff9d66;">${d.properties.name}</div>`)
      .style('left', `${event.pageX + 12}px`)
      .style('top', `${event.pageY - 16}px`)
      .style('opacity', 0.9);
  }
  d3.select(`#c-label-${d.id}`).classed('hovered', true);
}

function onCountryLeave() {
  if (d3.selectAll('.volcano-mark.hovered').empty() && !state.selectedVolcano) {
    tooltip.style('opacity', 0);
  }
  d3.selectAll('.country-label').classed('hovered', false);
}

async function onVolcanoSelect(d) {
  state.selectedVolcano = d;

  tooltip.style('opacity', 0);
  d3.selectAll('.volcano-mark').classed('hovered', false);
  d3.selectAll('.volcano-mark').classed('selected', false);
  d3.selectAll('.volcano-leader').classed('highlighted', false);
  d3.selectAll('.volcano-anchor-group').classed('highlighted', false);

  d3.select(`#v-mark-${d.id}`).classed('selected', true).raise();
  d3.select(`#leader-${d.id}`).classed('highlighted', true);
  d3.select(`#anchor-${d.id}`).classed('highlighted', true);

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
    d3.select(`#leader-${defaultV.id}`).classed('highlighted', true);
    d3.select(`#anchor-${defaultV.id}`).classed('highlighted', true);
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
