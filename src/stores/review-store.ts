'use client';

import { create } from 'zustand';
import { SrtSegment, Correction, SelectedWord } from '@/types';

interface ReviewStore {
  // 데이터
  segments: SrtSegment[];
  audioFile: File | null;
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

  // 복합 액션
  pauseAndRemember: () => void; // 오디오 정지 + 위치 저장 (AudioPlayer에서 구현)
  selectWord: (segmentIndex: number, wordIndex: number) => void;
  clearAll: () => void;
}

// wavesurfer 인스턴스에 접근하기 위한 ref (store 외부에 보관)
export let wavesurferRef: { current: import('wavesurfer.js').default | null } = {
  current: null,
};

export const useReviewStore = create<ReviewStore>((set, get) => ({
  // 초기값
  segments: [],
  audioFile: null,
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

  // 데이터 액션
  setSegments: (segments) => set({ segments }),
  setAudioFile: (file) => set({ audioFile: file }),
  setSrtFileName: (name) => set({ srtFileName: name }),

  // 수정 액션
  addCorrection: (correction) => {
    const { corrections, undoStack, segments } = get();

    // 동일 세그먼트+어절의 이전 수정이 있으면 교체
    const existingIdx = corrections.findIndex(
      (c) =>
        c.segmentIndex === correction.segmentIndex &&
        c.wordIndex === correction.wordIndex
    );

    let newCorrections: Correction[];
    if (existingIdx >= 0) {
      newCorrections = [...corrections];
      newCorrections[existingIdx] = correction;
    } else {
      newCorrections = [...corrections, correction];
    }

    // 동일 오류 일괄 적용 (실제 텍스트 수정인 경우만, null·원본 동일 제외)
    if (correction.corrected !== null && correction.corrected !== correction.original) {
      for (const seg of segments) {
        for (let wi = 0; wi < seg.words.length; wi++) {
          if (seg.index === correction.segmentIndex && wi === correction.wordIndex) continue;
          if (seg.words[wi] !== correction.original) continue;
          const alreadyExists = newCorrections.some(
            (c) => c.segmentIndex === seg.index && c.wordIndex === wi
          );
          if (alreadyExists) continue;
          newCorrections = [...newCorrections, {
            segmentIndex: seg.index,
            wordIndex: wi,
            original: correction.original,
            corrected: correction.corrected,
          }];
        }
      }
    }

    set({
      corrections: newCorrections,
      undoStack: [...undoStack, corrections],
      redoStack: [],
    });
  },

  removeCorrection: (segmentIndex, wordIndex) => {
    const { corrections, undoStack } = get();
    const newCorrections = corrections.filter(
      (c) => !(c.segmentIndex === segmentIndex && c.wordIndex === wordIndex)
    );
    set({
      corrections: newCorrections,
      undoStack: [...undoStack, corrections],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, corrections, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      corrections: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, corrections],
    });
  },

  redo: () => {
    const { redoStack, corrections, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      corrections: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, corrections],
    });
  },

  // 재생 액션
  setCurrentTime: (time) => {
    const { segments } = get();
    // 이진 탐색으로 활성 세그먼트 찾기
    let lo = 0;
    let hi = segments.length - 1;
    let activeIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const seg = segments[mid];
      if (time >= seg.startTime && time < seg.endTime) {
        activeIdx = mid;
        break;
      } else if (time < seg.startTime) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    // 활성 어절 찾기 (어절 시작 시간 기준 - 갭 구간도 직전 어절로 처리)
    let activeWordIdx = -1;
    if (activeIdx >= 0) {
      const wt = segments[activeIdx].wordTimings;
      if (wt) {
        for (let w = 0; w < wt.length; w++) {
          if (time >= wt[w].startTime) {
            activeWordIdx = w;
          } else {
            break;
          }
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
    if (ws && ws.isPlaying()) {
      ws.pause();
      set({ isPlaying: false });
    }
    set({
      selectedWord: { segmentIndex, wordIndex },
      resumePosition: time,
      activePanel: 'script',
    });
  },

  clearAll: () =>
    set({
      segments: [],
      audioFile: null,
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
    }),
}));
