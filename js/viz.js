/**
 * VISUALIZACIÓN DEL CINTURÓN DE FUEGO (INFOVIS UC)
 * Foco en el Radio Crítico de Evacuación (10 km) con Anillos Concéntricos Geográficos
 */

const state = {
  volcanoes: [],
  worldData: null,
  activeRadius: 'pop_10km', // Radio crítico de evacuación en Alerta Roja
  selectedVolcano: null
};

const colorScale = d3.scaleSequential()
  .domain([0, 7])
  .interpolator(d3.interpolateYlOrRd);

let svg, gRoot, gMap, gWaves, gVolcanoes, projection, pathGen, zoomBehavior;
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
  // Inicialización de audio al primer clic dentro de la visualización
  document.getElementById('viz-stage').addEventListener('click', () => {
    if (!window.volcanoAudio.isInitialized) {
      window.volcanoAudio.init().then(enabled => updateAudioUI(enabled));
    }
  }, { once: true });

  // Toggle de audio (si existe)
  const audioBtn = document.getElementById('btn-audio');
  if (audioBtn) {
    audioBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const enabled = await window.volcanoAudio.toggleAudio();
      updateAudioUI(enabled);
      if (enabled && state.selectedVolcano) {
        window.volcanoAudio.sonifyVolcano(state.selectedVolcano, 'pop_10km');
      }
    });
  }

  // Controles de zoom
  document.getElementById('btn-zoom-in').addEventListener('click', (e) => {
    e.stopPropagation();
    svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.4);
  });

  document.getElementById('btn-zoom-out').addEventListener('click', (e) => {
    e.stopPropagation();
    svg.transition().duration(250).call(zoomBehavior.scaleBy, 0.71);
  });

  document.getElementById('btn-zoom-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity);
  });
}

function updateAudioUI(enabled) {
  const btn = document.getElementById('btn-audio');
  const icon = document.getElementById('audio-icon');
  if (btn && icon) {
    if (enabled) {
      btn.classList.add('active');
      icon.textContent = '🔊';
    } else {
      btn.classList.remove('active');
      icon.textContent = '🔇';
    }
  }
}

function initVisualization() {
  const container = document.getElementById('viz-stage');
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select('#viz-svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  gRoot = svg.append('g').attr('class', 'root-g');
  gMap = gRoot.append('g').attr('class', 'map-g');
  gWaves = gRoot.append('g').attr('class', 'waves-g');
  gVolcanoes = gRoot.append('g').attr('class', 'volcanoes-g');

  // Proyección centrada en el Pacífico (-150° longitud en el centro)
  projection = d3.geoNaturalEarth1()
    .rotate([-150, 0])
    .scale(width / 5.2)
    .translate([width / 2, height / 2 + 15]);

  pathGen = d3.geoPath().projection(projection);

  // Cuadrícula sutil
  const graticule = d3.geoGraticule();
  gMap.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', pathGen);

  // Tierras emergidas
  if (state.worldData) {
    const countries = topojson.feature(state.worldData, state.worldData.objects.countries);
    gMap.append('g')
      .selectAll('path')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('class', 'land')
      .attr('d', pathGen);
  }

  // Zoom interactivo
  zoomBehavior = d3.zoom()
    .scaleExtent([0.9, 14])
    .on('start', () => {
      tooltip.style('opacity', 0);
    })
    .on('zoom', (event) => {
      gRoot.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);

  updateVolcanoMarks();
}

function updateVolcanoMarks() {
  // Ordenar de mayor a menor tamaño (Z-Index): los grandes al fondo, los pequeños encima
  const sorted = [...state.volcanoes].sort((a, b) => (b.pop_10km || 0) - (a.pop_10km || 0));

  const marks = gVolcanoes.selectAll('.volcano-mark')
    .data(sorted, d => d.id);

  marks.exit().remove();

  const enter = marks.enter()
    .append('circle')
    .attr('class', 'volcano-mark')
    .attr('id', d => `v-mark-${d.id}`)
    .attr('cx', d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[0] : -999;
    })
    .attr('cy', d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[1] : -999;
    })
    .attr('r', 0)
    .style('opacity', 0)
    .on('mouseenter', (event, d) => onVolcanoHover(event, d))
    .on('mouseleave', () => onVolcanoLeave())
    .on('click', (event, d) => onVolcanoSelect(d));

  marks.merge(enter)
    .order() // Garantiza que los elementos en el DOM sigan estrictamente el orden de tamaño
    .transition()
    .duration(400)
    .attr('cx', d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[0] : -999;
    })
    .attr('cy', d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[1] : -999;
    })
    .attr('r', d => {
      const pop = d.pop_10km || 0;
      if (pop === 0) return 2.8;
      return Math.min(17, Math.max(3.5, 3 + Math.log10(pop) * 2.2));
    })
    .style('fill', d => colorScale(d.max_vei))
    .style('stroke', '#0e0d0c')
    .style('stroke-width', '0.85px')
    .style('opacity', 0.72);
}

function onVolcanoHover(event, d) {
  // Si el volcán ya está seleccionado, NO mostrar el hover ni tick
  // porque su información ya se presenta destacada en el recuadro inferior
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
    <div class="tooltip-line"><span class="tooltip-dim">VEI:</span> <span>${d.max_vei}</span></div>
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

  // Ocultar hover inmediatamente al hacer clic (la información pasa al recuadro inferior)
  tooltip.style('opacity', 0);
  d3.selectAll('.volcano-mark').classed('hovered', false);

  d3.selectAll('.volcano-mark').classed('selected', false);
  d3.select(`#v-mark-${d.id}`).classed('selected', true).raise();

  // Enfocar suavemente en el volcán con zoom de D3
  const p = projection([d.lon, d.lat]);
  if (p) {
    const stage = document.getElementById('viz-stage');
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    svg.transition().duration(700).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(w / 2 - p[0] * 3, h / 2 - p[1] * 3).scale(3)
    );
  }

  // Activar la onda expansiva animada
  triggerConcentricWaves(d);

  // Actualizar ficha técnica con las barras
  renderInspectorCard(d);

  // Emitir sonido integrado
  if (!window.volcanoAudio.isInitialized) {
    await window.volcanoAudio.init();
    updateAudioUI(true);
  }

  window.volcanoAudio.sonifyVolcano(d, 'pop_10km');
}

/**
 * Onda expansiva animada sincronizada con el estruendo volcánico
 */
function triggerConcentricWaves(d) {
  const p = projection([d.lon, d.lat]);
  if (!p) return;

  gWaves.selectAll('*').remove();

  [1, 2, 3].forEach((idx) => {
    gWaves.append('circle')
      .attr('class', 'concentric-wave')
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', 4)
      .style('opacity', 0.9)
      .transition()
      .delay(idx * 150)
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('r', 24 + idx * 22)
      .style('opacity', 0)
      .remove();
  });
}

function renderInspectorCard(d) {
  const elTitle = document.getElementById('det-title');
  const elCountry = document.getElementById('det-country');
  const elVei = document.getElementById('det-vei');
  const elPop = document.getElementById('det-pop');

  if (elTitle) elTitle.textContent = d.name;
  if (elCountry) elCountry.textContent = d.country;
  if (elVei) elVei.textContent = `VEI ${d.max_vei}`;
  if (elPop) elPop.textContent = `${(d.pop_10km || 0).toLocaleString()} hab.`;
}

function selectDefaultVolcano() {
  const defaultV = state.volcanoes.find(v => v.name === 'Campi Flegrei') || state.volcanoes[0];
  if (defaultV) {
    state.selectedVolcano = defaultV;
    renderInspectorCard(defaultV);
    triggerConcentricWaves(defaultV);
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
