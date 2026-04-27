/**
 * SRT 타임스탬프 문자열 → 초 단위 숫자 변환
 * 예: "00:01:23,456" → 83.456
 */
export function srtTimeToSeconds(timeStr: string): number {
  const [hms, ms] = timeStr.split(',');
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

/**
 * 초 단위 숫자 → SRT 타임스탬프 문자열 변환
 * 예: 83.456 → "00:01:23,456"
 */
export function secondsToSrtTime(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const totalSec = Math.floor(seconds);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},${padMs(ms)}`;
}

/**
 * 초 단위 숫자 → "mm:ss" 표시용 문자열
 */
export function secondsToDisplayTime(seconds: number): string {
  const totalSec = Math.floor(seconds);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  return `${pad(m)}:${pad(s)}`;
}

/**
 * 초 단위 숫자 → "HH:MM:SS" 표시용 문자열 (타임스탬프 레이블용)
 */
export function secondsToTimestamp(seconds: number): string {
  const totalSec = Math.floor(seconds);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function padMs(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * 어절의 시작 시간 추정
 * segmentStart + segmentDuration * wordIndex / totalWords
 */
export function estimateWordStartTime(
  segmentStart: number,
  segmentEnd: number,
  wordIndex: number,
  totalWords: number
): number {
  const duration = segmentEnd - segmentStart;
  return segmentStart + duration * (wordIndex / totalWords);
}

/**
 * 어절의 끝 시간 추정
 */
export function estimateWordEndTime(
  segmentStart: number,
  segmentEnd: number,
  wordIndex: number,
  totalWords: number
): number {
  const duration = segmentEnd - segmentStart;
  return segmentStart + duration * ((wordIndex + 1) / totalWords);
}
