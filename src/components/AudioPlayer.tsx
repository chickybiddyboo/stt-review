'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useReviewStore, wavesurferRef } from '@/stores/review-store';
import { secondsToDisplayTime } from '@/lib/time-utils';

export default function AudioPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);

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
      waveColor: 'transparent',
      progressColor: 'transparent',
      cursorColor: 'transparent',
      height: 0,
      normalize: true,
    });

    wavesurferRef.current = ws;
    const url = URL.createObjectURL(audioFile);
    ws.load(url);

    ws.on('ready', () => setDuration(ws.getDuration()));
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
      setDuration(0);
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
    if (!ws.isPlaying()) setSelectedWord(null);
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

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    wavesurferRef.current?.seekTo(Math.max(0, Math.min(1, ratio)));
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white border-t border-gray-200 px-4 pt-3 pb-3 select-none">
      {/* WaveSurfer 컨테이너 — 오디오 재생 전용 */}
      <div ref={containerRef} style={{ height: 0, overflow: 'hidden' }} />

      {/* 심플 프로그레스 바 */}
      <div
        className="relative h-1.5 bg-gray-200 rounded-full cursor-pointer mb-3 group"
        onClick={handleSeek}
      >
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-blue-600 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* 컨트롤 + 배속 — 한 행 */}
      <div className="flex items-center gap-3">
        {/* 재생 컨트롤 */}
        <button
          onClick={rewind5}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0"
          title="5초 되감기 (←)"
        >
          «5s
        </button>

        <button
          onClick={togglePlay}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-base transition-colors flex-shrink-0 shadow-sm"
          title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={forward5}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0"
          title="5초 앞감기 (→)"
        >
          5s»
        </button>

        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
          {secondsToDisplayTime(currentTime)} / {secondsToDisplayTime(duration)}
        </span>

        {/* 배속 조절 — 오른쪽 영역 */}
        <div className="ml-auto flex flex-col gap-1.5 min-w-0">
          {/* 슬라이더 행 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-shrink-0">배속</span>
            <input
              type="range"
              min={0.25}
              max={3.0}
              step={0.05}
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="w-36 h-1.5 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-blue-600 w-9 text-right tabular-nums flex-shrink-0">
              {playbackRate.toFixed(2)}x
            </span>
          </div>

          {/* 단축 버튼 행 */}
          <div className="flex items-center gap-1 justify-end">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((v) => (
              <button
                key={v}
                onClick={() => setPlaybackRate(v)}
                className={`text-[11px] px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
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
