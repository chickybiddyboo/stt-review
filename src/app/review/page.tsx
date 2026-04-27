'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import ScriptPanel from '@/components/ScriptPanel';
import CorrectionList from '@/components/CorrectionList';
import AudioPlayer from '@/components/AudioPlayer';
import { exportSrt, downloadSrt } from '@/lib/srt-exporter';

export default function ReviewPage() {
  const router = useRouter();
  const {
    segments,
    audioFile,
    srtFileName,
    corrections,
    isPlaying,
    resumePosition,
    undo,
    redo,
    setSelectedWord,
    selectedWord,
  } = useReviewStore();

  // 패널 너비 리사이즈
  const containerRef = useRef<HTMLDivElement>(null);
  const [correctionPct, setCorrectionPct] = useState(30); // %
  const isDragging = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((rect.right - e.clientX) / rect.width) * 100;
      setCorrectionPct(Math.min(50, Math.max(15, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!audioFile || segments.length === 0) router.replace('/');
  }, [audioFile, segments, router]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (selectedWord) { e.preventDefault(); setSelectedWord(null); }
        return;
      }
      if (isInput) return;

      if (e.key === ' ') {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws) return;
        if (isPlaying) {
          ws.pause();
        } else {
          // 재생 시작 시 수정 입력창 닫기
          setSelectedWord(null);
          if (resumePosition !== null) {
            const dur = ws.getDuration();
            if (dur > 0) ws.seekTo(resumePosition / dur);
            useReviewStore.setState({ resumePosition: null });
          }
          ws.play();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws) return;
        const { segments } = useReviewStore.getState();
        const cur = ws.getCurrentTime();
        const dur = ws.getDuration() || 1;
        // 현재 세그먼트·어절 찾기
        let segIdx = segments.findIndex((s) => cur >= s.startTime && cur < s.endTime);
        if (segIdx === -1) segIdx = segments.findIndex((s) => cur < s.startTime);
        if (segIdx === -1) segIdx = segments.length - 1;
        const seg = segments[segIdx];
        const wt = seg?.wordTimings;
        let wordIdx = -1;
        if (wt) { for (let w = 0; w < wt.length; w++) { if (cur >= wt[w].startTime) wordIdx = w; } }

        let target: number;
        if (e.key === 'ArrowLeft') {
          if (wt && wordIdx > 0) target = wt[wordIdx - 1].startTime;
          else if (segIdx > 0) {
            const ps = segments[segIdx - 1];
            target = ps.wordTimings?.at(-1)?.startTime ?? ps.startTime;
          } else target = wt?.[0]?.startTime ?? seg.startTime;
        } else {
          if (wt && wordIdx < wt.length - 1) target = wt[wordIdx + 1].startTime;
          else if (segIdx < segments.length - 1) {
            const ns = segments[segIdx + 1];
            target = ns.wordTimings?.[0]?.startTime ?? ns.startTime;
          } else target = wt?.at(-1)?.startTime ?? seg.startTime;
        }
        ws.seekTo(Math.max(0, Math.min(dur, target)) / dur);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
        if (e.key === 'z') { e.preventDefault(); undo(); return; }
      }
    },
    [isPlaying, resumePosition, selectedWord, setSelectedWord, undo, redo]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = () => downloadSrt(exportSrt(segments, corrections), srtFileName);

  if (!audioFile || segments.length === 0) return null;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-gray-800">STT 스크립트 검수</h1>
          <span className="text-xs text-gray-400 truncate max-w-48">{audioFile.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            수정된 SRT 다운로드
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* 스크립트 영역 */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${100 - correctionPct}%` }}
        >
          <ScriptPanel />
          <div className="flex-shrink-0">
            <AudioPlayer />
          </div>
        </div>

        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={onDragStart}
          className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors active:bg-blue-500"
          title="드래그하여 너비 조절"
        />

        {/* 수정 목록 패널 */}
        <div
          className="flex flex-col overflow-hidden border-l border-gray-200"
          style={{ width: `${correctionPct}%` }}
        >
          <CorrectionList />
        </div>
      </div>
    </div>
  );
}
