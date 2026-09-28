import * as Tone from 'tone';

let isInitialized = false;

// Synths for V2 (Tennis metaphor)
let grassBounceSynth;
let racketHitSynth;
let racketNoise;
let netHitSynth;

export async function initAudio() {
    if (isInitialized) return;
    
    await Tone.start();
    
    // Grass bounce (thud)
    grassBounceSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
    }).toDestination();
    
    // Racket hit (Tock!)
    racketHitSynth = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 4,
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
    }).toDestination();
    
    racketNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
    }).toDestination();
    
    // Net hit (Dull thud / mistake)
    netHitSynth = new Tone.MembraneSynth({
        pitchDecay: 0.2,
        octaves: 1.5,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 }
    }).toDestination();
    
    isInitialized = true;
}

let lastBounce = 0;
export function playGrassBounce() {
    if (!isInitialized) return;
    const now = Tone.now();
    if (now - lastBounce < 0.1) return;
    lastBounce = now;
    const note = Tone.Frequency('G2').transpose(Math.random() * 2 - 1);
    grassBounceSynth.triggerAttackRelease(note, '8n', now);
}

let lastHit = 0;
export function playRacketHit() {
    if (!isInitialized) return;
    const now = Tone.now();
    if (now - lastHit < 0.1) return;
    lastHit = now;
    racketHitSynth.triggerAttackRelease('C4', '16n', now);
    racketNoise.triggerAttackRelease('16n', now);
}

let lastNet = 0;
export function playNetHit() {
    if (!isInitialized) return;
    const now = Tone.now();
    if (now - lastNet < 0.1) return;
    lastNet = now;
    netHitSynth.triggerAttackRelease('C2', '8n', now);
}
