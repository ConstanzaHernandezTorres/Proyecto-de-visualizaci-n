/**
 * VISUALIZACIÓN DE AMENAZA VOLCÁNICA GLOBAL (INFOVIS UC - IIC2026)
 * Enfoque analítico: Los 61 volcanes con explosividad crítica (VEI ≥ 4) y población masiva a 10 km
 * 
 * Implementa los principios del curso:
 * - Cápsula 17: La Pregunta Antes del Gráfico (enfoque en riesgo humanitario crítico).
 * - Cápsula 18: Ostras vs. Perlas (filtro explicativo por defecto, no dispersión exploratoria).
 * - Cápsula 19: Bórralo (Data-Ink Ratio de Tufte, eliminación de ruido de fondo).
 * - Cápsula 22: El Mantra de Shneiderman (Overview first, zoom & filter, details on demand).
 * - Cápsula 23: Sonificación con Tone.js (subgraves sísmicos y ritmo cardíaco de urgencia).
 */

const FILTERS = {
  critical: {
    id: 'critical',
    label: '61 volcanes críticos',
    statusText: 'Mostrando: <strong>61</strong> volcanes de riesgo crítico',
    filterFn: d => (d.max_vei >= 4) && ((d.pop_10km || 0) >= 10000)
  },
  high_vei: {
    id: 'high_vei',
    label: '208 volcanes de alto VEI',
    statusText: 'Mostrando: <strong>208</strong> volcanes de alta explosividad',
    filterFn: d => (d.max_vei >= 4)
  },
  all: {
    id: 'all',
    label: '958 volcanes (catálogo total)',
    statusText: 'Mostrando: <strong>958</strong> volcanes (catálogo total)',
    filterFn: () => true
  }
};

const state = {
  volcanoes: [],
  worldData: null,
  activeRadius: 'pop_10km',
  currentFilter: 'critical',
  selectedVolcano: null
};

const colorScale = d3.scaleSequential()
  .domain([0, 7])
  .interpolator(d3.interpolateYlOrRd);

let svg, gRoot, gMap, gWaves, gVolcanoes, projection, pathGen, zoomBehavior;
const tooltip = d3.select('#tooltip');

document.addEventListener('DOMContentLoaded', async () => {
  setupUIEvents();
  setupFilterControls();
  setupQuickChips();
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

function setupFilterControls() {
  const filterBtns = document.querySelectorAll('.btn-filter');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filterKey = btn.dataset.filter;
      if (!FILTERS[filterKey] || state.currentFilter === filterKey) return;

      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.currentFilter = filterKey;
      updateVolcanoMarks();

      // Si el volcán seleccionado no cumple con el nuevo filtro, seleccionar el primero disponible
      const currentPredicate = FILTERS[state.currentFilter].filterFn;
      if (state.selectedVolcano && !currentPredicate(state.selectedVolcano)) {
        const available = state.volcanoes.filter(currentPredicate);
        if (available.length > 0) {
          onVolcanoSelect(available[0]);
        }
      }
    });
  });
}

function setupQuickChips() {
  const chips = document.querySelectorAll('.quick-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = parseInt(chip.dataset.id, 10);
      const targetVolcano = state.volcanoes.find(v => v.id === targetId);

      if (!targetVolcano) return;

      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      // Asegurar que el filtro permita ver este volcán si está en modo restrictivo
      const predicate = FILTERS[state.currentFilter].filterFn;
      if (!predicate(targetVolcano)) {
        // Cambiar a 'critical' o 'all' según corresponda
        const newFilter = (targetVolcano.max_vei >= 4 && (targetVolcano.pop_10km || 0) >= 10000) ? 'critical' : 'all';
        state.currentFilter = newFilter;
        document.querySelectorAll('.btn-filter').forEach(b => {
          b.classList.toggle('active', b.dataset.filter === newFilter);
        });
        updateVolcanoMarks();
      }

      onVolcanoSelect(targetVolcano);
    });
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
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select('#viz-svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  gRoot = svg.append('g').attr('class', 'root-g');
  gMap = gRoot.append('g').attr('class', 'map-g');
  gWaves = gRoot.append('g').attr('class', 'waves-g');
  gVolcanoes = gRoot.append('g').attr('class', 'volcanoes-g');

  // Proyección centrada en el Pacífico (-150° longitud en el centro para Cinturón de Fuego continuo)
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
  const filterDef = FILTERS[state.currentFilter] || FILTERS.critical;
  const filtered = state.volcanoes.filter(filterDef.filterFn);

  // Orden descendente por población para resolver Overplotting (círculos grandes abajo, pequeños arriba)
  const sorted = [...filtered].sort((a, b) => (b.pop_10km || 0) - (a.pop_10km || 0));

  // Actualizar indicador de leyenda
  const statusEl = document.getElementById('legend-status');
  if (statusEl) {
    statusEl.innerHTML = filterDef.statusText;
  }

  const marks = gVolcanoes.selectAll('.volcano-mark')
    .data(sorted, d => d.id);

  // Salida con desvanecimiento suave (Cápsula 19: eliminar ruido)
  marks.exit()
    .transition()
    .duration(300)
    .attr('r', 0)
    .style('opacity', 0)
    .remove();

  // Entrada
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

  // Merge y actualización con animación fluida
  marks.merge(enter)
    .order()
    .transition()
    .duration(450)
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
      if (pop === 0) return 3.0;
      return Math.min(18, Math.max(4.0, 3.2 + Math.log10(pop) * 2.3));
    })
    .style('fill', d => colorScale(d.max_vei))
    .style('stroke', '#0e0d0c')
    .style('stroke-width', '0.85px')
    .style('opacity', 0.82);

  // Re-destacar el volcán seleccionado si sigue en pantalla
  if (state.selectedVolcano) {
    d3.select(`#v-mark-${state.selectedVolcano.id}`).classed('selected', true).raise();
  }
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

  // Ocultar hover inmediatamente al hacer clic
  tooltip.style('opacity', 0);
  d3.selectAll('.volcano-mark').classed('hovered', false);

  d3.selectAll('.volcano-mark').classed('selected', false);
  d3.select(`#v-mark-${d.id}`).classed('selected', true).raise();

  // Actualizar chips activos si coincide el volcán
  document.querySelectorAll('.quick-chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.id, 10) === d.id);
  });

  // Enfocar suavemente en el volcán con zoom cinemático
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

  // Actualizar ficha técnica
  renderInspectorCard(d);

  // Emitir sonido integrado en Tone.js
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
      .style('opacity', 0.95)
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
      elBadge.textContent = '🟡 MONITOREO';
      elBadge.className = 'ins-badge badge-moderate';
    }
  }
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
