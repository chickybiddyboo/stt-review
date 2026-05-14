'use client';

import { useReviewStore } from '@/stores/review-store';
import { Correction } from '@/types';

// 클릭 vs 드래그 구분용 모듈 레벨 플래그
let _didDrag = false;

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
  const {
    selectWord,
    setActivePanel,
    isDragging,
    dragStart,
    dragEnd,
    startDrag,
    updateDrag,
    cancelDrag,
    duplicateFlow,
  } = useReviewStore();

  // ── 드래그 범위 내 여부 계산 ──────────────────────────────
  const isInDragRange = (() => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    const startSeg = Math.min(dragStart.segmentIndex, dragEnd.segmentIndex);
    const endSeg   = Math.max(dragStart.segmentIndex, dragEnd.segmentIndex);
    if (segmentIndex < startSeg || segmentIndex > endSeg) return false;

    if (dragStart.segmentIndex === dragEnd.segmentIndex) {
      if (segmentIndex !== dragStart.segmentIndex) return false;
      const startW = Math.min(dragStart.wordIndex, dragEnd.wordIndex);
      const endW   = Math.max(dragStart.wordIndex, dragEnd.wordIndex);
      return wordIndex >= startW && wordIndex <= endW;
    }
    // 크로스 세그먼트
    if (segmentIndex === startSeg) {
      const startW = dragStart.segmentIndex < dragEnd.segmentIndex ? dragStart.wordIndex : dragEnd.wordIndex;
      return wordIndex >= startW;
    }
    if (segmentIndex === endSeg) {
      const endW = dragStart.segmentIndex < dragEnd.segmentIndex ? dragEnd.wordIndex : dragStart.wordIndex;
      return wordIndex <= endW;
    }
    return true; // 중간 세그먼트
  })();

  // ── 동일 오류 플로우 대기 중인 어절 ──────────────────────
  const isPendingDuplicate = duplicateFlow
    ? duplicateFlow.pending.some((p) => p.segmentIndex === segmentIndex && p.wordIndex === wordIndex)
    : false;

  // ── 마우스 핸들러 ─────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    _didDrag = false;
    startDrag({ segmentIndex, wordIndex });
  };

  const handleMouseEnter = () => {
    if (!isDragging) return;
    const { dragStart: ds } = useReviewStore.getState();
    if (ds && (ds.segmentIndex !== segmentIndex || ds.wordIndex !== wordIndex)) {
      _didDrag = true;
    }
    updateDrag({ segmentIndex, wordIndex });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (_didDrag) {
      _didDrag = false;
      return; // 드래그였으면 클릭 무시 (commitDrag는 document mouseup이 처리)
    }
    cancelDrag();
    setActivePanel('script');
    selectWord(segmentIndex, wordIndex);
  };

  // ── 스타일 결정 ──────────────────────────────────────────
  const isDeleted     = correction?.corrected === null;
  const isCorrected   = correction !== undefined && correction.corrected !== null && correction.corrected !== text;
  const hasReviewNote = Boolean(correction?.reviewNote);
  const isFlagged     = correction !== undefined && correction.corrected === text;
  const displayText   = isDeleted ? text : isCorrected ? correction.corrected! : text;

  let boxStyle: string;
  if (hasReviewNote) {
    boxStyle = 'bg-red-200 text-red-800';
  } else if (isSelected) {
    boxStyle = 'bg-red-200 text-red-800';
  } else if (isInDragRange) {
    boxStyle = 'bg-orange-200 text-orange-800';
  } else if (isPendingDuplicate) {
    boxStyle = 'bg-amber-200 text-amber-800 ring-1 ring-amber-400';
  } else if (isCorrected) {
    boxStyle = 'bg-green-200 text-green-800';
  } else if (isDeleted) {
    boxStyle = 'bg-green-200 text-green-800 line-through';
  } else if (isFlagged) {
    boxStyle = 'bg-red-200 text-red-800';
  } else if (isActiveWord) {
    boxStyle = 'bg-yellow-200 text-gray-900';
  } else {
    boxStyle = 'text-gray-800 hover:bg-gray-100';
  }

  return (
    <span
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      className={`relative inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-colors leading-relaxed select-none ${boxStyle}`}
      title={isCorrected ? `원본: ${text}` : isPendingDuplicate ? `동일 오류: ${text}` : undefined}
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
