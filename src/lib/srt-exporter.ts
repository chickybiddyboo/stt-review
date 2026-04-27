import { SrtSegment, Correction } from '@/types';
import { secondsToSrtTime } from './time-utils';

/**
 * corrections를 segments에 적용하여 최종 단어 배열을 반환
 */
function applyCorrections(
  segment: SrtSegment,
  corrections: Correction[]
): string[] {
  const words = [...segment.words];
  const segCorrections = corrections.filter(
    (c) => c.segmentIndex === segment.index
  );

  for (const correction of segCorrections) {
    if (correction.wordIndex < words.length) {
      if (correction.corrected === null) {
        words[correction.wordIndex] = ''; // 삭제 마킹
      } else {
        words[correction.wordIndex] = correction.corrected;
      }
    }
  }

  return words.filter((w) => w !== '');
}

/**
 * SrtSegment[] + Correction[] → SRT 문자열
 */
export function exportSrt(
  segments: SrtSegment[],
  corrections: Correction[]
): string {
  const lines: string[] = [];

  for (const segment of segments) {
    const words = applyCorrections(segment, corrections);
    const text = words.join(' ');

    // 화자 레이블이 있으면 앞에 붙이기
    const fullText = segment.speaker ? `${segment.speaker}: ${text}` : text;

    lines.push(String(segment.index));
    lines.push(
      `${secondsToSrtTime(segment.startTime)} --> ${secondsToSrtTime(segment.endTime)}`
    );
    lines.push(fullText);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * SRT 문자열을 파일로 다운로드
 */
export function downloadSrt(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
