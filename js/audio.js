/**
 * MOTOR DE SONIFICACIÓN INTEGRADO CON TONE.JS
 * InfoVis IIC2026 PUC - Proyecto Volcanes
 *
 * El sonido está completamente incorporado dentro de la interacción de la visualización:
 * - VEI (Fuerza Geológica) -> Frecuencia Fundamental (Subgrave FM telúrico).
 * - Población amenazada -> Pulso cardíaco (Tempo BPM proporcional al riesgo humano).
 * - Analizador de audio en tiempo real para visualizador de ondas integrado en la pantalla.
 */

class VolcanoAudioEngine {
  constructor() {
    this.isInitialized = false;
    this.isEnabled = false;
    this.activeVolcano = null;
    this.pulseInterval = null;
    this.activeRadius = 'pop_10km';

    this.rumbleSynth = null;
    this.pulseSynth = null;
    this.clickSynth = null;
    this.analyser = null;
  }

  async init() {
    if (this.isInitialized) {
      if (Tone.context.state !== 'running') {
        await Tone.context.resume();
      }
      this.isEnabled = true;
      return true;
    }

    try {
      await Tone.start();
      await Tone.context.resume();

      // Analizador de onda para alimentar el visualizador gráfico integrado
      this.analyser = new Tone.Analyser('waveform', 64);

      // 1. Sintetizador subgrave para el estruendo volcánico
      this.rumbleSynth = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.08, decay: 0.9, sustain: 0.3, release: 1.4 },
        filterEnvelope: { attack: 0.04, decay: 0.5, sustain: 0.2, release: 0.8, baseFrequency: 75, octaves: 2.2 }
      });
      this.rumbleSynth.volume.value = -4;
      this.rumbleSynth.connect(this.analyser);
      this.rumbleSynth.toDestination();

      // 2. Sintetizador de membrana para el pulso de urgencia humana
      this.pulseSynth = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.22, sustain: 0.01, release: 0.25 }
      });
      this.pulseSynth.volume.value = -6;
      this.pulseSynth.connect(this.analyser);
      this.pulseSynth.toDestination();

      // 3. Clic acústico sutil para hover
      this.clickSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }
      });
      this.clickSynth.volume.value = -18;
      this.clickSynth.toDestination();

      this.isInitialized = true;
      this.isEnabled = true;
      return true;
    } catch (e) {
      console.warn('Audio no inicializado:', e);
      return false;
    }
  }

  toggleAudio() {
    if (!this.isInitialized) {
      return this.init();
    }
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      this.stopAll();
    }
    return Promise.resolve(this.isEnabled);
  }

  playHoverTick() {
    if (!this.isEnabled || !this.isInitialized) return;
    try {
      this.clickSynth.triggerAttackRelease('A5', '32n');
    } catch (e) {}
  }

  sonifyVolcano(volcano, radiusKey = 'pop_10km') {
    if (!this.isEnabled || !this.isInitialized) return;
    this.stopAll();

    this.activeVolcano = volcano;
    this.activeRadius = radiusKey;

    const vei = volcano.max_vei || 0;
    const pop = volcano[radiusKey] || 0;

    // 1. Tono subgrave según VEI (mientras mayor VEI, nota más profunda)
    const veiFrequencies = ['D2', 'C2', 'Bb1', 'A1', 'F#1', 'E1', 'D1', 'C1'];
    const note = veiFrequencies[Math.min(vei, 7)] || 'C2';
    const duration = Math.max(0.7, 0.5 + vei * 0.25);

    try {
      this.rumbleSynth.triggerAttackRelease(note, duration);
    } catch (e) {}

    // 2. Pulso rítmico cardíaco según población expuesta
    if (pop > 0) {
      const logPop = Math.log10(Math.max(pop, 1));
      const bpm = Math.min(165, Math.max(48, 48 + (logPop / 7) * 115));
      const intervalMs = (60 / bpm) * 1000;

      let beatsCount = 0;
      const maxBeats = 7;

      this.pulseInterval = setInterval(() => {
        if (!this.isEnabled) {
          clearInterval(this.pulseInterval);
          return;
        }
        try {
          this.pulseSynth.triggerAttackRelease('C2', '16n');
        } catch (err) {}

        beatsCount++;
        if (beatsCount >= maxBeats) {
          clearInterval(this.pulseInterval);
          this.pulseInterval = null;
        }
      }, intervalMs);
    }
  }

  getWaveformData() {
    if (!this.analyser || !this.isInitialized) return null;
    return this.analyser.getValue();
  }

  stopAll() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
  }
}

window.volcanoAudio = new VolcanoAudioEngine();
