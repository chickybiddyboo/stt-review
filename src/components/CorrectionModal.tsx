'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SrtSegment } from '@/types';
import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import { estimateWordStartTime, estimateWordEndTime } from '@/lib/time-utils';

interface CorrectionModalProps {
  segmentIndex: number;
  wordIndex: number;
  originalWord: string;
  currentCorrection?: string;
  segment: SrtSegment;
}

export default function CorrectionModal({
  segmentIndex,
  wordIndex,
  originalWord,
  currentCorrection,
  segment,
}: CorrectionModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLTextAreaElement>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    addCorrection,
    setSelectedWord,
    setIsLooping,
    playbackRate,
    setResumePosition,
    segments,
    corrections,
    duplicateFlow,
    setDuplicateFlow,
  } = useReviewStore();

  // 이 어절이 동일 오류 플로우의 대기 목록에 있는지 확인
  const isInFlow = duplicateFlow?.pending.some(
    (p) => p.segmentIndex === segmentIndex && p.wordIndex === wordIndex
  ) ?? false;

  // 사전 입력값: 이미 수정됐거나, 동일 오류 플로우의 제안값 사용
  const suggestedValue = isInFlow ? (duplicateFlow?.suggestedCorrection ?? originalWord) : undefined;

  const [value, setValue] = useState(currentCorrection ?? suggestedValue ?? originalWord);
  const [loopActive, setLoopActive] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [localRate, setLocalRate] = useState(playbackRate);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (showReview) reviewRef.current?.focus();
  }, [showReview]);

  const getPlayRange = useCallback(() => {
    const totalWords = segment.words.length;
    const prevIndex = Math.max(0, wordIndex - 2);
    const startTime = segment.wordTimings
      ? segment.wordTimings[prevIndex].startTime
      : estimateWordStartTime(segment.startTime, segment.endTime, prevIndex, totalWords);
    const endTime = segment.wordTimings
      ? segment.wordTimings[wordIndex].endTime
      : estimateWordEndTime(segment.startTime, segment.endTime, wordIndex, totalWords);
    return { startTime, endTime, duration: endTime - startTime };
  }, [segment, wordIndex]);

  const clearTimer = useCallback(() => {
    if (loopTimerRef.current) { clearTimeout(loopTimerRef.current); loopTimerRef.current = null; }
  }, []);

  const stopLoop = useCallback(() => {
    clearTimer();
    const ws = wavesurferRef.current;
    if (ws) { ws.pause(); ws.setPlaybackRate(playbackRate); }
    setLoopActive(false);
    setIsLooping(false);
  }, [clearTimer, setIsLooping, playbackRate]);

  const playOnce = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    clearTimer();
    setLoopActive(false);
    setIsLooping(false);
    const { startTime, duration } = getPlayRange();
    const dur = ws.getDuration();
    if (!dur || dur <= 0) return;
    ws.setPlaybackRate(localRate);
    ws.seekTo(startTime / dur);
    ws.play();
    loopTimerRef.current = setTimeout(() => {
      ws.pause();
      ws.setPlaybackRate(playbackRate);
    }, duration * 1000 / localRate);
  }, [clearTimer, setIsLooping, getPlayRange, localRate, playbackRate]);

  const startLoop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setLoopActive(true);
    setIsLooping(true);
    const playLoop = () => {
      const { startTime, duration } = getPlayRange();
      const dur = ws.getDuration();
      if (!dur || dur <= 0) return;
      ws.setPlaybackRate(localRate);
      ws.seekTo(startTime / dur);
      ws.play();
      loopTimerRef.current = setTimeout(() => {
        ws.pause();
        loopTimerRef.current = setTimeout(playLoop, 300);
      }, duration * 1000 / localRate);
    };
    playLoop();
  }, [getPlayRange, setIsLooping, localRate]);

  const toggleLoop = useCallback(() => {
    loopActive ? stopLoop() : startLoop();
  }, [loopActive, startLoop, stopLoop]);

  // keepFlow: save() 내부에서 호출할 때 duplicateFlow를 유지하기 위함
  const close = useCallback((keepFlow = false) => {
    stopLoop();
    setSelectedWord(null);
    if (!keepFlow) {
      setDuplicateFlow(null);
    }
  }, [stopLoop, setSelectedWord, setDuplicateFlow]);

  const save = useCallback(() => {
    const trimmed = value.trim();
    const note = reviewNote.trim() || undefined;

    // 변경 없으면 닫기만
    if (trimmed === originalWord && currentCorrection === undefined && !note) {
      close(false);
      return;
    }

    // 저장 전에 현재 상태 스냅샷 (addCorrection 이전)
    const currentCorrs = useReviewStore.getState().corrections;
    const allSegs = useReviewStore.getState().segments;
    const currentFlow = useReviewStore.getState().duplicateFlow;

    // 수정 저장
    addCorrection({
      segmentIndex,
      wordIndex,
      original: originalWord,
      corrected: trimmed || null,
      reviewNote: note,
    });

    // ── 동일 오류 플로우 처리 ──────────────────────────────
    let nextFlow = null;
    let nextWord: { segmentIndex: number; wordIndex: number } | null = null;

    if (currentFlow && isInFlow) {
      // 이미 플로우 진행 중 → 현재 어절 제거 후 다음으로
      const newPending = currentFlow.pending.filter(
        (p) => !(p.segmentIndex === segmentIndex && p.wordIndex === wordIndex)
      );
      if (newPending.length > 0) {
        nextFlow = { ...currentFlow, pending: newPending };
        nextWord = newPending[0];
      }
    } else if (trimmed && trimmed !== originalWord && !currentFlow) {
      // 첫 번째 수정 → 동일 단어 중복 오류 탐색
      const pending: { segmentIndex: number; wordIndex: number }[] = [];
      for (const seg of allSegs) {
        for (let wi = 0; wi < seg.words.length; wi++) {
          if (seg.index === segmentIndex && wi === wordIndex) continue;
          const alreadyCorrected = currentCorrs.find(
            (c) => c.segmentIndex === seg.index && c.wordIndex === wi
          );
          if (!alreadyCorrected && seg.words[wi] === originalWord) {
            pending.push({ segmentIndex: seg.index, wordIndex: wi });
          }
        }
      }
      if (pending.length > 0) {
        nextFlow = { originalWord, suggestedCorrection: trimmed, pending };
        nextWord = pending[0];
      }
    }

    // 패널 닫기 (keepFlow=true → duplicateFlow 유지해서 나중에 덮어씀)
    close(nextFlow !== null);

    if (nextFlow && nextWord) {
      // 새 플로우 설정 + 다음 어절로 이동
      setDuplicateFlow(nextFlow);
      const nextSeg = allSegs.find((s) => s.index === nextWord!.segmentIndex);
      const ws = wavesurferRef.current;
      if (ws && nextSeg) {
        const dur = ws.getDuration();
        if (dur > 0) ws.seekTo(nextSeg.startTime / dur);
      }
      setTimeout(() => {
        useReviewStore.getState().selectWord(nextWord!.segmentIndex, nextWord!.wordIndex);
      }, 30);
      setResumePosition(null);
      return; // 자동 재생 생략
    }

    // ── 일반 저장: 다음 어절부터 자동 재생 ──────────────────
    const ws = wavesurferRef.current;
    if (ws) {
      const dur = ws.getDuration();
      if (dur > 0) {
        const totalWords = segment.words.length;
        const nextIdx = wordIndex + 1;
        let nextStartTime: number;
        if (nextIdx < totalWords) {
          nextStartTime = segment.wordTimings
            ? segment.wordTimings[nextIdx].startTime
            : estimateWordStartTime(segment.startTime, segment.endTime, nextIdx, totalWords);
        } else {
          nextStartTime = segment.endTime;
        }
        ws.seekTo(nextStartTime / dur);
        ws.play();
      }
    }
    setResumePosition(null);
  }, [
    value, reviewNote, originalWord, currentCorrection,
    addCorrection, segmentIndex, wordIndex, close,
    segment, setResumePosition, isInFlow, setDuplicateFlow,
  ]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(false); }
  };

  useEffect(() => {
    return () => { if (loopTimerRef.current) clearTimeout(loopTimerRef.current); };
  }, []);

  // 플로우 진행 상황 표시
  const flowTotal = duplicateFlow
    ? duplicateFlow.pending.length + (isInFlow ? 0 : 0)
    : 0;

  return (
    <div className="w-full mt-2 bg-red-50 border border-red-200 rounded-lg p-3" onClick={(e) => e.stopPropagation()}>

      {/* 동일 오류 플로우 배너 */}
      {isInFlow && duplicateFlow && (
        <div className="flex items-center justify-between mb-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs">
          <span className="text-amber-700 font-medium">
            ⚡ &apos;{duplicateFlow.originalWord}&apos; 동일 오류 {duplicateFlow.pending.length}건 남음
          </span>
          <button
            onClick={() => setDuplicateFlow(null)}
            className="text-amber-500 hover:text-amber-700 text-[10px] ml-2"
          >
            흐름 취소
          </button>
        </div>
      )}

      {/* 수정 입력 */}
      <div className="mb-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border border-red-200 bg-white rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          placeholder="수정할 내용 입력..."
        />
      </div>

      {/* 재검토 사유 */}
      {showReview && (
        <textarea
          ref={reviewRef}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(false); }
          }}
          placeholder="재검토 사유 입력... (Enter로 저장)"
          rows={2}
          className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-2"
        />
      )}

      {/* 재생·반복·속도·저장 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={playOnce}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex-shrink-0"
          title="해당 구간 재생"
        >
          <span className="text-[10px]">▶</span> 재생
        </button>
        <button
          onClick={toggleLoop}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ${
            loopActive ? 'bg-red-500 text-white' : 'bg-red-100 hover:bg-red-200 text-red-700'
          }`}
          title="반복 재생"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          반복
        </button>

        <input
          type="range" min={0.5} max={2} step={0.25} value={localRate}
          onChange={(e) => setLocalRate(Number(e.target.value))}
          className="w-14 h-1 accent-red-400 cursor-pointer"
          title={`구간 배속: ${localRate}x`}
        />
        <span className="text-[10px] font-medium text-red-500 w-6 flex-shrink-0">{localRate}x</span>

        <button
          onClick={() => setShowReview((v) => !v)}
          className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full transition-colors flex-shrink-0 ${
            showReview ? 'bg-amber-500 text-white' : 'bg-red-100 hover:bg-red-200 text-red-600'
          }`}
          title="재검토 사유 입력"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill={showReview ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          재검토
        </button>
        <button
          onClick={save}
          className="text-xs px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors font-medium flex-shrink-0"
        >
          {isInFlow ? `저장 후 다음 →` : '저장'}
        </button>
      </div>
    </div>
  );
}
