'use client';

import { useMemo, useState } from 'react';
import { useReviewStore } from '@/stores/review-store';
import ScriptSegment from './ScriptSegment';

export default function ScriptPanel() {
  const { segments, activeSegmentIndex, activeWordIndex, corrections, setActivePanel } =
    useReviewStore();
  const [fontSize, setFontSize] = useState(14);

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const seg of segments) {
      if (seg.speaker && !map.has(seg.speaker)) {
        map.set(seg.speaker, idx++);
      }
    }
    return map;
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        SRT 파일을 로드하면 여기에 스크립트가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" onClick={() => setActivePanel('script')}>
      {/* 글자 크기 조절 바 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0 bg-white">
        <span className="text-xs text-gray-400 flex-shrink-0">가</span>
        <input
          type="range"
          min={11}
          max={22}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-24 h-1 accent-blue-500 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-base text-gray-400 flex-shrink-0">가</span>
      </div>

      {/* 세그먼트 목록 */}
      <div className="flex-1 overflow-y-auto">
        {segments.map((segment, arrayIdx) => (
          <ScriptSegment
            key={segment.index}
            segment={segment}
            segmentArrayIndex={arrayIdx}
            isActive={arrayIdx === activeSegmentIndex}
            activeWordIndex={arrayIdx === activeSegmentIndex ? activeWordIndex : -1}
            corrections={corrections}
            speakerColorMap={speakerColorMap}
            fontSize={fontSize}
          />
        ))}
      </div>
    </div>
  );
}
