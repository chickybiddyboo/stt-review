'use client';

import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import { Correction } from '@/types';
import { estimateWordStartTime } from '@/lib/time-utils';

interface WordProps {
  segmentIndex: number;
  wordIndex: number;
  text: string;
  correction: Correction | undefined;
  isSelected: boolean;
  isActiveWord?: boolean;
}

export default function Word({
  segmentIndex,
  wordIndex,
  text,
  correction,
  isSelected,
  isActiveWord = false,
}: WordProps) {
  const { selectWord, setActivePanel, addCorrection } = useReviewStore();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePanel('script');

    // 클릭한 어절 위치로 프로그레스 바 이동
    const ws = wavesurferRef.current;
    if (ws) {
      const { segments } = useReviewStore.getState();
      const seg = segments.find((s) => s.index === segmentIndex);
      if (seg) {
        const dur = ws.getDuration();
        if (dur > 0) {
          const wordTime = seg.wordTimings
            ? seg.wordTimings[wordIndex].startTime
            : estimateWordStartTime(seg.startTime, seg.endTime, wordIndex, seg.words.length);
          ws.seekTo(wordTime / dur);
        }
      }
    }

    if (!correction) {
      addCorrection({ segmentIndex, wordIndex, original: text, corrected: text });
    }
    selectWord(segmentIndex, wordIndex);
  };

  const isDeleted = correction?.corrected === null;
  const isCorrected = correction !== undefined && correction.corrected !== null && correction.corrected !== text;
  const hasReviewNote = Boolean(correction?.reviewNote);
  const displayText = isDeleted ? text : isCorrected ? correction.corrected! : text;

  // 상태별 스타일 (재검수 > 선택 > 수정 > 삭제 > 재생중 > 기본 순 우선순위)
  let boxStyle: string;
  if (hasReviewNote) {
    boxStyle = 'bg-red-200 text-red-800';
  } else if (isSelected) {
    boxStyle = 'bg-red-200 text-red-800';
  } else if (isCorrected) {
    boxStyle = 'bg-green-200 text-green-800';
  } else if (isDeleted) {
    boxStyle = 'bg-red-200 text-red-800 line-through';
  } else if (isActiveWord) {
    boxStyle = 'bg-yellow-200 text-gray-900';
  } else {
    boxStyle = 'text-gray-800 hover:bg-gray-100';
  }

  return (
    <span
      onClick={handleClick}
      className={`relative inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-colors leading-relaxed ${boxStyle}`}
      title={isCorrected ? `원본: ${text}` : undefined}
    >
      {displayText}
      {hasReviewNote && (
        <svg
          className="absolute -top-1.5 -right-1 text-amber-500"
          width="8" height="8" viewBox="0 0 24 24"
          fill="currentColor" stroke="none"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        </svg>
      )}
    </span>
  );
}
