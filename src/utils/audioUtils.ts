import { getChordMidiNotes } from './chordUtils';

// Web Audio API chord player
class AudioChordPlayer {
  private ctx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Convert MIDI note number to frequency (Hz)
  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  public playChord(chordName: string, durationSeconds = 1.6): void {
    const ctx = this.getContext();
    if (!ctx) return;

    this.stop();

    const notes = getChordMidiNotes(chordName);
    const now = ctx.currentTime;

    // Master volume gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, now);
    masterGain.connect(ctx.destination);

    notes.forEach((midiNote, index) => {
      const freq = this.midiToFreq(midiNote);

      // Stagger notes slightly (15ms) for realistic strum effect
      const noteStartTime = now + (index * 0.02);

      // Main tone (sine/triangle for warm piano-like tone)
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, noteStartTime);

      // Overtone for richness
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, noteStartTime);

      // Note envelope
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.001, noteStartTime);
      // Attack
      noteGain.gain.exponentialRampToValueAtTime(0.35, noteStartTime + 0.04);
      // Decay / Release
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + durationSeconds);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.08, noteStartTime);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteStartTime + durationSeconds * 0.7);

      osc1.connect(noteGain);
      noteGain.connect(masterGain);

      osc2.connect(overtoneGain);
      overtoneGain.connect(masterGain);

      osc1.start(noteStartTime);
      osc2.start(noteStartTime);

      osc1.stop(noteStartTime + durationSeconds);
      osc2.stop(noteStartTime + durationSeconds);

      this.activeOscillators.push(osc1, osc2);
      this.activeGainNodes.push(noteGain, overtoneGain);
    });
  }

  public stop(): void {
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore if already stopped
      }
    });
    this.activeGainNodes.forEach(gain => {
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeOscillators = [];
    this.activeGainNodes = [];
  }
}

export const chordPlayer = new AudioChordPlayer();
