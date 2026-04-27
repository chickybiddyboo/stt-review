'use client';

import { useRef, useEffect } from 'react';
import { SrtSegment, Correction } from '@/types';
import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import Word from './Word';
import CorrectionModal from './CorrectionModal';

const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-red-100 text-red-700',
];

interface ScriptSegmentProps {
  segment: SrtSegment;
  segmentArrayIndex: number;
  isActive: boolean;
  activeWordIndex: number;
  corrections: Correction[];
  speakerColorMap: Map<string, number>;
  fontSize: number;
}

export default function ScriptSegment({
  segment,
  segmentArrayIndex,
  isActive,
  activeWordIndex,
  corrections,
  speakerColorMap,
  fontSize,
}: ScriptSegmentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { selectedWord, setActivePanel } = useReviewStore();

  useEffect(() => {
    if (isActive && ref.current) {
      const container = ref.current.parentElement;
      if (container) {
        const target = ref.current.offsetTop - container.clientHeight / 3;
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }
    }
  }, [isActive]);

  const handleSegmentClick = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setActivePanel('script');
    const dur = ws.getDuration();
    if (dur > 0) ws.seekTo(segment.startTime / dur);
  };

  const speakerColor = segment.speaker
    ? SPEAKER_COLORS[(speakerColorMap.get(segment.speaker) ?? 0) % SPEAKER_COLORS.length]
    : null;

  return (
    <div
      ref={ref}
      className={`relative px-4 py-3 border-b border-dashed border-gray-200 transition-colors
        ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={handleSegmentClick}
    >
      {/* 화자 레이블 */}
      {segment.speaker && (
        <div className="mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${speakerColor}`}>
            {segment.speaker}
          </span>
        </div>
      )}

      {/* 어절 목록 */}
      <div
        className="flex flex-wrap gap-y-1"
        style={{ fontSize }}
      >
        {segment.words.map((word, wordIdx) => {
          const correction = corrections.find(
            (c) => c.segmentIndex === segment.index && c.wordIndex === wordIdx
          );
          const isWordSelected =
            selectedWord?.segmentIndex === segment.index &&
            selectedWord?.wordIndex === wordIdx;

          return (
            <Word
              key={wordIdx}
              segmentIndex={segment.index}
              wordIndex={wordIdx}
              text={word}
              correction={correction}
              isSelected={isWordSelected}
              isActiveWord={wordIdx === activeWordIndex}
            />
          );
        })}
      </div>

      {/* 인라인 수정 입력창 — 선택된 어절 아래에 스크립트 흐름 안에 표시 */}
      {selectedWord?.segmentIndex === segment.index && (
        <CorrectionModal
          segmentIndex={segment.index}
          wordIndex={selectedWord.wordIndex}
          originalWord={segment.words[selectedWord.wordIndex]}
          currentCorrection={
            corrections.find(
              (c) => c.segmentIndex === segment.index && c.wordIndex === selectedWord.wordIndex
            )?.corrected ?? undefined
          }
          segment={segment}
        />
      )}
    </div>
  );
}
