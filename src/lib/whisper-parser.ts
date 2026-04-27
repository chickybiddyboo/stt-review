import { SrtSegment, WordTiming } from '@/types';

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

interface WhisperOutput {
  text: string;
  segments: WhisperSegment[];
  language?: string;
}

/**
 * Whisper JSON 포맷인지 확인
 */
export function isWhisperJson(content: string): boolean {
  try {
    const data = JSON.parse(content);
    return (
      typeof data === 'object' &&
      data !== null &&
      Array.isArray(data.segments) &&
      typeof data.text === 'string'
    );
  } catch {
    return false;
  }
}

/**
 * Whisper JSON → SrtSegment[] 파싱
 * 어절별 정확한 타임스탬프(wordTimings)를 포함
 */
export function parseWhisperJson(content: string): SrtSegment[] {
  const data: WhisperOutput = JSON.parse(content);

  if (!data.segments || !Array.isArray(data.segments)) {
    throw new Error('올바른 Whisper JSON 형식이 아닙니다.');
  }

  return data.segments.map((seg, index) => {
    const text = seg.text.trim();
    const words = text.split(/\s+/).filter(Boolean);

    let wordTimings: WordTiming[] | undefined;

    if (seg.words && seg.words.length > 0) {
      // 선행 공백 제거 후 빈 항목 필터링
      const whisperWords = seg.words
        .map((w) => ({
          text: w.word.trim(),
          startTime: w.start,
          endTime: w.end,
        }))
        .filter((w) => w.text !== '');

      // 어절 수가 일치하면 1:1 매핑, 다르면 인덱스 기준으로 매핑하고 나머지는 균등 추정
      wordTimings = words.map((_, i) => {
        if (i < whisperWords.length) {
          return {
            startTime: whisperWords[i].startTime,
            endTime: whisperWords[i].endTime,
          };
        }
        // 범위 초과 시 세그먼트 시간으로 균등 추정 (fallback)
        const segDur = seg.end - seg.start;
        return {
          startTime: seg.start + (segDur * i) / words.length,
          endTime: seg.start + (segDur * (i + 1)) / words.length,
        };
      });
    }

    return {
      index: index + 1,
      startTime: seg.start,
      endTime: seg.end,
      speaker: null,
      text,
      words,
      wordTimings,
    };
  });
}
