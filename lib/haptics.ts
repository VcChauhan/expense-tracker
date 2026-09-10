// Haptic feedback utility using Web Vibration API

function canVibrate(): boolean {
  return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
}

export function lightTap(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate(10);
    } catch {}
  }
}

export function mediumTap(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate(25);
    } catch {}
  }
}

export function successBuzz(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate([20, 40, 35]);
    } catch {}
  }
}

export function errorShake(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate([40, 30, 40, 30, 60]);
    } catch {}
  }
}

export function warningPulse(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate([30, 40, 30]);
    } catch {}
  }
}
