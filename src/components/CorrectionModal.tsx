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

  const { addCorrection, setSelectedWord, setIsLooping, playbackRate, resumePosition, setResumePosition } = useReviewStore();

  const [value, setValue] = useState(currentCorrection ?? originalWord);
  const [loopActive, setLoopActive] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  // 전역 오디오 플레이어와 독립된 로컬 배속 (재생·반복 구간에만 적용)
  const [localRate, setLocalRate] = useState(playbackRate);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (showReview) {
      reviewRef.current?.focus();
    }
  }, [showReview]);

  const getPlayRange = useCallback(() => {
    const totalWords = segment.words.length;
    const prevIndex = Math.max(0, wordIndex - 2);

    // startTime: n-2 어절부터 (Whisper JSON: 정확한 타임스탬프 / SRT: 균등 추정)
    const startTime = segment.wordTimings
      ? segment.wordTimings[prevIndex].startTime
      : estimateWordStartTime(segment.startTime, segment.endTime, prevIndex, totalWords);

    // endTime: 오류 어절 끝까지
    const endTime = segment.wordTimings
      ? segment.wordTimings[wordIndex].endTime
      : estimateWordEndTime(segment.startTime, segment.endTime, wordIndex, totalWords);

    return { startTime, endTime, duration: endTime - startTime };
  }, [segment, wordIndex]);

  // 타이머만 정리 (ws.pause 없음 — play 직전 pause가 race condition 유발)
  const clearTimer = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    clearTimer();
    const ws = wavesurferRef.current;
    if (ws) {
      ws.pause();
      ws.setPlaybackRate(playbackRate); // 전역 배속 복원
    }
    setLoopActive(false);
    setIsLooping(false);
  }, [clearTimer, setIsLooping, playbackRate]);

  const playOnce = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // 기존 타이머만 정리 (ws.pause() 호출 금지 — 직후 play와 충돌)
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
      ws.setPlaybackRate(playbackRate); // 전역 배속 복원
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
  }, [getPlayRange, setIsLooping, localRate, playbackRate]);

  const toggleLoop = useCallback(() => {
    loopActive ? stopLoop() : startLoop();
  }, [loopActive, startLoop, stopLoop]);

  const close = useCallback(() => {
    stopLoop();
    setSelectedWord(null);
  }, [stopLoop, setSelectedWord]);

  const save = useCallback(() => {
    const trimmed = value.trim();
    const note = reviewNote.trim() || undefined;
    if (trimmed === originalWord && currentCorrection === undefined && !note) {
      close();
      return;
    }
    addCorrection({
      segmentIndex,
      wordIndex,
      original: originalWord,
      corrected: trimmed || null,
      reviewNote: note,
    });
    close(); // stopLoop → ws.pause() + setSelectedWord(null)
    // 수정 저장 직후 다음 어절부터 오디오 재생
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
  }, [value, reviewNote, originalWord, currentCorrection, addCorrection, segmentIndex, wordIndex, close, segment, setResumePosition]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  useEffect(() => {
    return () => { if (loopTimerRef.current) clearTimeout(loopTimerRef.current); };
  }, []);

  return (
    <div className="w-full mt-2 bg-red-50 border border-red-200 rounded-lg p-3" onClick={(e) => e.stopPropagation()}>
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

      {/* 재검토 사유 (토글) */}
      {showReview && (
        <textarea
          ref={reviewRef}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
          }}
          placeholder="재검토 사유 입력... (Enter로 저장)"
          rows={2}
          className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-2"
        />
      )}

      {/* 재생·반복·속도(로컬)·저장 — 한 줄 */}
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
            loopActive
              ? 'bg-red-500 text-white'
              : 'bg-red-100 hover:bg-red-200 text-red-700'
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

        {/* 로컬 배속 슬라이더 — 이 입력창의 재생·반복에만 적용 */}
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.25}
          value={localRate}
          onChange={(e) => setLocalRate(Number(e.target.value))}
          className="w-14 h-1 accent-red-400 cursor-pointer"
          title={`구간 배속: ${localRate}x`}
        />
        <span className="text-[10px] font-medium text-red-500 w-6 flex-shrink-0">
          {localRate}x
        </span>

        <button
          onClick={() => setShowReview((v) => !v)}
          className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full transition-colors flex-shrink-0 ${
            showReview
              ? 'bg-amber-500 text-white'
              : 'bg-red-100 hover:bg-red-200 text-red-600'
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
          저장
        </button>
      </div>
    </div>
  );
}
