// Web Speech API ("2 minutes check rhythm") + Web Audio fallback for 2-minute CPR cycle alerts
// Unlocked during user gestures (Start CPR / Start Time Cycle / Test Sound) so mobile & desktop browsers allow async voice playback.

let sharedAudioCtx: AudioContext | null = null;
let speechPrimed = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function unlockCprAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.01);
    }
  } catch {
    // Ignore Web Audio errors
  }

  // Prime Web Speech API inside user gesture for iOS/Safari/mobile Chrome compatibility
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (!speechPrimed) {
        speechPrimed = true;
        const primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
      }
    }
  } catch {
    // Ignore SpeechSynthesis errors
  }
}

export function cancelCprSpeech(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Ignore
  }
}

function scheduleTone(
  ctx: AudioContext,
  startOffsetSec: number,
  frequencyHz: number,
  durationSec: number,
  peakGain = 0.24
): void {
  const start = ctx.currentTime + startOffsetSec;
  const end = start + durationSec;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequencyHz, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.setValueAtTime(peakGain, Math.max(start + 0.02, end - 0.03));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(end + 0.01);
}

function playFallbackChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    scheduleTone(ctx, 0.0, 880, 0.13, 0.28);
    scheduleTone(ctx, 0.15, 1046.5, 0.13, 0.3);
    scheduleTone(ctx, 0.3, 1318.5, 0.18, 0.32);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Speaks "2 minutes check rhythm" using Web Speech API (with chime fallback if speechSynthesis is unsupported).
 */
export function playTwoMinuteCycleAlarm(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance('2 minutes check rhythm');
      utterance.lang = 'en-US';
      utterance.rate = 0.96;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onerror = () => {
        playFallbackChime();
      };

      window.speechSynthesis.speak(utterance);
      return;
    }
  } catch {
    // Fallback to chime below
  }

  playFallbackChime();
}

export function playTestSoundChime(): void {
  playTwoMinuteCycleAlarm();
}
