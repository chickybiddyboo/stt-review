'use client';

import { useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import { secondsToDisplayTime } from '@/lib/time-utils';

export default function AudioPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    audioFile,
    isPlaying,
    currentTime,
    playbackRate,
    setIsPlaying,
    setPlaybackRate,
    setSelectedWord,
  } = useReviewStore();

  useEffect(() => {
    if (!containerRef.current || !audioFile) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8',
      progressColor: '#3b82f6',
      cursorColor: '#1d4ed8',
      height: 44,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });

    wavesurferRef.current = ws;
    const url = URL.createObjectURL(audioFile);
    ws.load(url);

    ws.on('audioprocess', (time) => {
      useReviewStore.getState().setCurrentTime(time);
    });
    ws.on('seeking', (time) => {
      useReviewStore.getState().setCurrentTime(time);
    });
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      ws.destroy();
      URL.revokeObjectURL(url);
      wavesurferRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile]);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    // 재생 시작할 때만 수정 입력창 닫기
    if (!ws.isPlaying()) {
      setSelectedWord(null);
    }
    ws.playPause();
  }, [setSelectedWord]);

  const rewind5 = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.seekTo(Math.max(0, ws.getCurrentTime() - 5) / (ws.getDuration() || 1));
  }, []);

  const forward5 = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const dur = ws.getDuration() || 1;
    ws.seekTo(Math.min(dur, ws.getCurrentTime() + 5) / dur);
  }, []);

  const duration = wavesurferRef.current?.getDuration() ?? 0;

  return (
    <div className="bg-white border-t border-gray-200 px-4 pt-2 pb-3 select-none">
      {/* 파형 */}
      <div ref={containerRef} className="mb-2" />

      {/* 컨트롤 행 */}
      <div className="flex items-center gap-2">
        {/* 5초 되감기 */}
        <button
          onClick={rewind5}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0"
          title="5초 되감기 (←)"
        >
          « 5s
        </button>

        {/* 재생/정지 */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs transition-colors flex-shrink-0"
          title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* 5초 앞감기 */}
        <button
          onClick={forward5}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0"
          title="5초 앞감기 (→)"
        >
          5s »
        </button>

        {/* 시간 */}
        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
          {secondsToDisplayTime(currentTime)} / {secondsToDisplayTime(duration)}
        </span>

        {/* 배속 조절 */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-400 flex-shrink-0">배속</span>
          <input
            type="range"
            min={0.25}
            max={3.0}
            step={0.05}
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="w-20 h-1 accent-blue-500 cursor-pointer"
          />
          <span className="text-xs font-medium text-blue-600 w-8 text-center tabular-nums flex-shrink-0">
            {playbackRate.toFixed(2)}x
          </span>
          <div className="flex items-center gap-1 ml-1">
            {[1.0, 1.25, 1.5, 2.0, 3.0].map((v) => (
              <button
                key={v}
                onClick={() => setPlaybackRate(v)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                  playbackRate === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                {v % 1 === 0 ? `${v}.0` : v}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
