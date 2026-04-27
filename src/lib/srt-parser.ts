import { SrtSegment } from '@/types';
import { srtTimeToSeconds } from './time-utils';

/**
 * 화자 레이블 패턴: "[화자1]", "(화자1)", "화자1:" 등
 */
const SPEAKER_PATTERNS = [
  /^\[(.+?)\]\s*/,
  /^\((.+?)\)\s*/,
  /^([가-힣a-zA-Z0-9_\s]+?):\s+/,
];

function extractSpeaker(text: string): { speaker: string | null; text: string } {
  for (const pattern of SPEAKER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        speaker: match[1].trim(),
        text: text.slice(match[0].length).trim(),
      };
    }
  }
  return { speaker: null, text: text.trim() };
}

/**
 * SRT 파일 텍스트 → SrtSegment[] 파싱
 */
export function parseSrt(content: string): SrtSegment[] {
  // BOM 제거, 줄바꿈 정규화
  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const blocks = normalized.trim().split(/\n\n+/);
  const segments: SrtSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0].trim(), 10);
    if (isNaN(index)) continue;

    const timeLine = lines[1].trim();
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = srtTimeToSeconds(timeMatch[1]);
    const endTime = srtTimeToSeconds(timeMatch[2]);

    // 텍스트 라인 합치기 (멀티라인 지원)
    const rawText = lines.slice(2).join(' ').trim();
    const { speaker, text } = extractSpeaker(rawText);

    // 어절 분리 (공백 기준) — 빈 어절 제거
    const words = text.split(/\s+/).filter(Boolean);

    segments.push({ index, startTime, endTime, speaker, text, words });
  }

  return segments;
}
