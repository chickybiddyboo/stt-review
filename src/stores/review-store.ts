'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SrtSegment, Correction, SelectedWord } from '@/types';

export interface DuplicateFlow {
  originalWord: string;
  suggestedCorrection: string | null;
  /** 아직 수정되지 않은 동일 오류 위치 목록 */
  pending: { segmentIndex: number; wordIndex: number }[];
  /** 플로우를 시작한 첫 번째 수정 어절 위치 */
  originSegmentIndex: number;
  originWordIndex: number;
}

interface ReviewStore {
  // 데이터
  segments: SrtSegment[];
  audioFile: File | null;
  audioFileName: string;
  srtFileName: string;
  corrections: Correction[];
  undoStack: Correction[][];
  redoStack: Correction[][];

  // 재생 상태
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  activeSegmentIndex: number;
  activeWordIndex: number;
  resumePosition: number | null;
  isLooping: boolean;

  // UI 상태
  selectedWord: SelectedWord | null;
  activePanel: 'script' | 'corrections';

  // 드래그 선택 (미저장 — partialize 제외)
  isDragging: boolean;
  dragStart: { segmentIndex: number; wordIndex: number } | null;
  dragEnd: { segmentIndex: number; wordIndex: number } | null;

  // 동일 오류 반복 수정 플로우 (미저장)
  duplicateFlow: DuplicateFlow | null;

  // 액션: 데이터
  setSegments: (segments: SrtSegment[]) => void;
  setAudioFile: (file: File) => void;
  setSrtFileName: (name: string) => void;

  // 액션: 수정
  addCorrection: (correction: Correction) => void;
  removeCorrection: (segmentIndex: number, wordIndex: number) => void;
  undo: () => void;
  redo: () => void;

  // 액션: 재생
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setActiveSegmentIndex: (index: number) => void;
  setResumePosition: (pos: number | null) => void;
  setIsLooping: (looping: boolean) => void;

  // 액션: UI
  setSelectedWord: (word: SelectedWord | null) => void;
  setActivePanel: (panel: 'script' | 'corrections') => void;

  // 액션: 드래그 선택
  startDrag: (pos: { segmentIndex: number; wordIndex: number }) => void;
  updateDrag: (pos: { segmentIndex: number; wordIndex: number }) => void;
  commitDrag: () => void;
  cancelDrag: () => void;

  // 액션: 동일 오류 플로우
  setDuplicateFlow: (flow: DuplicateFlow | null) => void;

  // 복합 액션
  pauseAndRemember: () => void;
  selectWord: (segmentIndex: number, wordIndex: number) => void;
  clearAll: () => void;
}

export let wavesurferRef: { current: import('wavesurfer.js').default | null } = {
  current: null,
};

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      // 초기값
      segments: [],
      audioFile: null,
      audioFileName: '',
      srtFileName: 'output.srt',
      corrections: [],
      undoStack: [],
      redoStack: [],

      currentTime: 0,
      isPlaying: false,
      playbackRate: 1,
      activeSegmentIndex: -1,
      activeWordIndex: -1,
      resumePosition: null,
      isLooping: false,

      selectedWord: null,
      activePanel: 'script',

      isDragging: false,
      dragStart: null,
      dragEnd: null,
      duplicateFlow: null,

      // 데이터 액션
      setSegments: (segments) => set({ segments }),
      setAudioFile: (file) => set({ audioFile: file, audioFileName: file.name }),
      setSrtFileName: (name) => set({ srtFileName: name }),

      // 수정 액션
      addCorrection: (correction) => {
        const { corrections, undoStack } = get();
        const existingIdx = corrections.findIndex(
          (c) => c.segmentIndex === correction.segmentIndex && c.wordIndex === correction.wordIndex
        );
        let newCorrections: Correction[];
        if (existingIdx >= 0) {
          newCorrections = [...corrections];
          newCorrections[existingIdx] = correction;
        } else {
          newCorrections = [...corrections, correction];
        }
        set({ corrections: newCorrections, undoStack: [...undoStack, corrections], redoStack: [] });
      },

      removeCorrection: (segmentIndex, wordIndex) => {
        const { corrections, undoStack } = get();
        const newCorrections = corrections.filter(
          (c) => !(c.segmentIndex === segmentIndex && c.wordIndex === wordIndex)
        );
        set({ corrections: newCorrections, undoStack: [...undoStack, corrections], redoStack: [] });
      },

      undo: () => {
        const { undoStack, corrections, redoStack } = get();
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        set({ corrections: prev, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, corrections] });
      },

      redo: () => {
        const { redoStack, corrections, undoStack } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        set({ corrections: next, redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, corrections] });
      },

      // 재생 액션
      setCurrentTime: (time) => {
        const { segments } = get();
        let lo = 0, hi = segments.length - 1, activeIdx = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const seg = segments[mid];
          if (time >= seg.startTime && time < seg.endTime) { activeIdx = mid; break; }
          else if (time < seg.startTime) hi = mid - 1;
          else lo = mid + 1;
        }
        let activeWordIdx = -1;
        if (activeIdx >= 0) {
          const wt = segments[activeIdx].wordTimings;
          if (wt) {
            for (let w = 0; w < wt.length; w++) {
              if (time >= wt[w].startTime) activeWordIdx = w; else break;
            }
          }
        }
        set({ currentTime: time, activeSegmentIndex: activeIdx, activeWordIndex: activeWordIdx });
      },
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setActiveSegmentIndex: (index) => set({ activeSegmentIndex: index }),
      setResumePosition: (pos) => set({ resumePosition: pos }),
      setIsLooping: (looping) => set({ isLooping: looping }),

      // UI 액션
      setSelectedWord: (word) => set({ selectedWord: word }),
      setActivePanel: (panel) => set({ activePanel: panel }),

      // 드래그 선택 액션
      startDrag: (pos) => set({ isDragging: true, dragStart: pos, dragEnd: pos }),

      updateDrag: (pos) => set({ dragEnd: pos }),

      commitDrag: () => {
        const { isDragging, dragStart, dragEnd, segments, corrections, undoStack } = get();
        if (!isDragging) return;
        set({ isDragging: false, dragStart: null, dragEnd: null });

        if (!dragStart || !dragEnd) return;
        // 동일 위치 = 클릭 → 드래그 커밋 안 함
        if (dragStart.segmentIndex === dragEnd.segmentIndex && dragStart.wordIndex === dragEnd.wordIndex) return;

        // 드래그 범위 내 어절 계산 (세그먼트 배열 인덱스 기준)
        const startSI = segments.findIndex((s) => s.index === dragStart.segmentIndex);
        const endSI = segments.findIndex((s) => s.index === dragEnd.segmentIndex);
        if (startSI === -1 || endSI === -1) return;

        const [fromSI, toSI] = startSI <= endSI ? [startSI, endSI] : [endSI, startSI];
        const from = startSI <= endSI ? dragStart : dragEnd;
        const to = startSI <= endSI ? dragEnd : dragStart;

        const newItems: Correction[] = [];
        for (let si = fromSI; si <= toSI; si++) {
          const seg = segments[si];
          const startWI = si === fromSI ? from.wordIndex : 0;
          const endWI = si === toSI ? to.wordIndex : seg.words.length - 1;
          for (let wi = startWI; wi <= endWI; wi++) {
            const exists = corrections.find((c) => c.segmentIndex === seg.index && c.wordIndex === wi);
            if (!exists) {
              newItems.push({ segmentIndex: seg.index, wordIndex: wi, original: seg.words[wi], corrected: seg.words[wi] });
            }
          }
        }

        if (newItems.length > 0) {
          set({ corrections: [...corrections, ...newItems], undoStack: [...undoStack, corrections], redoStack: [] });
        }
      },

      cancelDrag: () => set({ isDragging: false, dragStart: null, dragEnd: null }),

      // 동일 오류 플로우 액션
      setDuplicateFlow: (flow) => set({ duplicateFlow: flow }),

      // 복합 액션
      pauseAndRemember: () => {
        const ws = wavesurferRef.current;
        if (!ws) return;
        const time = ws.getCurrentTime();
        ws.pause();
        set({ isPlaying: false, resumePosition: time });
      },

      selectWord: (segmentIndex, wordIndex) => {
        const ws = wavesurferRef.current;
        const time = ws ? ws.getCurrentTime() : get().currentTime;
        if (ws && ws.isPlaying()) { ws.pause(); set({ isPlaying: false }); }
        set({ selectedWord: { segmentIndex, wordIndex }, resumePosition: time, activePanel: 'script' });
      },

      clearAll: () =>
        set({
          segments: [], audioFile: null, audioFileName: '', corrections: [],
          undoStack: [], redoStack: [], currentTime: 0, isPlaying: false,
          playbackRate: 1, activeSegmentIndex: -1, activeWordIndex: -1,
          resumePosition: null, isLooping: false, selectedWord: null, activePanel: 'script',
          isDragging: false, dragStart: null, dragEnd: null, duplicateFlow: null,
        }),
    }),
    {
      name: 'stt-review-session',
      partialize: (state) => ({
        segments: state.segments,
        corrections: state.corrections,
        srtFileName: state.srtFileName,
        audioFileName: state.audioFileName,
        playbackRate: state.playbackRate,
      }),
    }
  )
);
