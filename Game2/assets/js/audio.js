export class GameAudio {
  constructor(settings = {}) {
    this.enabled = settings.music ?? true;
    this.sfxEnabled = settings.sfx ?? true;
    this.volume = settings.volume ?? 0.38;
    this.context = null;
    this.musicTimer = 0;
    this.noteIndex = 0;
    this.sequence = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];
  }

  async unlock() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return;
    }

    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async startMusic() {
    if (!this.enabled) {
      return;
    }

    await this.unlock();

    if (!this.context || this.musicTimer) {
      return;
    }

    this.playMusicNote();
    this.musicTimer = window.setInterval(() => this.playMusicNote(), 260);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }
  }

  setMusic(enabled) {
    this.enabled = enabled;

    if (!enabled) {
      this.stopMusic();
      return;
    }

    this.startMusic();
  }

  setSfx(enabled) {
    this.sfxEnabled = enabled;
  }

  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, Number(volume) || 0));
  }

  playMove() {
    this.playTone(180, 0.045, "triangle", 0.16);
  }

  playMerge(value) {
    const root = Math.min(740, 220 + Math.log2(value) * 42);
    this.playTone(root, 0.07, "sine", 0.24);
    this.playTone(root * 1.5, 0.06, "triangle", 0.12, 0.025);
  }

  playWin() {
    [392, 523.25, 659.25, 783.99].forEach((freq, index) => {
      this.playTone(freq, 0.12, "sine", 0.28, index * 0.09);
    });
  }

  playGameOver() {
    [329.63, 293.66, 220].forEach((freq, index) => {
      this.playTone(freq, 0.16, "sawtooth", 0.12, index * 0.1);
    });
  }

  playMusicNote() {
    if (!this.enabled || !this.context) {
      return;
    }

    const freq = this.sequence[this.noteIndex % this.sequence.length];
    const accent = this.noteIndex % 4 === 0 ? 0.12 : 0.07;
    this.playTone(freq, 0.16, "triangle", accent, 0, true);
    this.noteIndex += 1;
  }

  playTone(freq, duration, type = "sine", gain = 0.12, delay = 0, music = false) {
    if ((!music && !this.sfxEnabled) || (!this.context && !music)) {
      return;
    }

    if (!this.context) {
      return;
    }

    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * this.volume), now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(envelope);
    envelope.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }
}
