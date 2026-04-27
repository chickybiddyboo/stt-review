export interface WordTiming {
  startTime: number;
  endTime: number;
}

export interface SrtSegment {
  index: number;
  startTime: number;
  endTime: number;
  speaker: string | null;
  text: string;
  words: string[];
  wordTimings?: WordTiming[]; // 어절별 정확한 타임스탬프 (Whisper JSON 입력 시)
}

export interface Correction {
  segmentIndex: number;
  wordIndex: number;
  original: string;
  corrected: string | null; // null = deleted
  reviewNote?: string;      // 재검토 사유 (입력 시에만 존재)
}

export interface SelectedWord {
  segmentIndex: number;
  wordIndex: number;
}
