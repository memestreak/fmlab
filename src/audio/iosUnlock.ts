// On iOS, Web Audio counts as "ambient" sound and is muted by the ringer
// switch, which makes a synth look broken. Two ways round it, both of which
// have to happen inside a user gesture.

/** The Audio Session API, where there is one (Safari 16.4 and later). */
interface AudioSessionNavigator {
  audioSession?: { type: string };
}

/**
 * One second of silence as a WAV file: 8-bit mono at 8 kHz, where silence
 * is the byte 128.
 */
export function silentWav(): Uint8Array<ArrayBuffer> {
  const sampleRate = 8000;
  const dataLength = sampleRate;
  const bytes = new Uint8Array(44 + dataLength).fill(128);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // size of the fmt chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // bytes per second
  view.setUint16(32, 1, true); // bytes per frame
  view.setUint16(34, 8, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, dataLength, true);
  return bytes;
}

function isIos(): boolean {
  // An iPad says it is a Mac; a Mac has no touch screen.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  );
}

/**
 * Makes sound play with the ringer switch on silent. Where the Audio
 * Session API exists, saying the page is "playback" is all it takes.
 * Older iOS gets the same effect from a media element that is playing, so
 * there the returned element loops silence: `play()` it with the sound and
 * `pause()` it after. Null when no element is needed.
 */
export function unlockIosAudio(): HTMLAudioElement | null {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) {
    session.type = 'playback';
    return null;
  }
  if (!isIos()) return null;

  const silence = new Audio(
    URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' })),
  );
  silence.loop = true;
  silence.setAttribute('playsinline', '');
  return silence;
}
