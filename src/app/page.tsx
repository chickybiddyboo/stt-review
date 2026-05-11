'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/FileUploader';
import { useReviewStore } from '@/stores/review-store';
import { parseSrt } from '@/lib/srt-parser';
import { parseWhisperJson, isWhisperJson } from '@/lib/whisper-parser';

export default function UploadPage() {
  const router = useRouter();
  const { setSegments, setAudioFile, setSrtFileName, clearAll, segments, corrections, audioFileName } =
    useReviewStore();

  const [audioFile, setLocalAudio] = useState<File | null>(null);
  const [scriptFile, setLocalScript] = useState<File | null>(null);
  const [resumeAudio, setResumeAudio] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSavedSession = segments.length > 0;

  // 새 파일로 검수 시작
  const handleStart = async () => {
    if (!audioFile || !scriptFile) {
      setError('오디오 파일과 스크립트 파일을 모두 업로드해주세요.');
      return;
    }

    try {
      clearAll();
      const text = await scriptFile.text();

      let parsedSegments;
      const isJson = scriptFile.name.endsWith('.json') || isWhisperJson(text);

      if (isJson) {
        parsedSegments = parseWhisperJson(text);
      } else {
        parsedSegments = parseSrt(text);
      }

      if (parsedSegments.length === 0) {
        setError('스크립트 파일을 파싱할 수 없습니다. 형식을 확인해주세요.');
        return;
      }

      setSegments(parsedSegments);
      setAudioFile(audioFile);
      setSrtFileName(scriptFile.name.replace(/\.(srt|json)$/i, '_corrected.srt'));

      router.push('/review');
    } catch {
      setError('파일 처리 중 오류가 발생했습니다.');
    }
  };

  // 이전 작업 이어하기
  const handleResume = () => {
    if (!resumeAudio) {
      setError('오디오 파일을 업로드해주세요.');
      return;
    }
    setAudioFile(resumeAudio);
    router.push('/review');
  };

  const canStart = audioFile !== null && scriptFile !== null;
  const canResume = resumeAudio !== null;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            STT 스크립트 검수 도구
          </h1>
          <p className="text-gray-500 text-sm">
            오디오 파일과 SRT 스크립트를 업로드하여 검수를 시작하세요
          </p>
        </div>

        {/* 이전 작업 이어하기 */}
        {hasSavedSession && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-blue-700">이전 작업 이어하기</p>
                <p className="text-xs text-blue-400 mt-0.5">
                  {audioFileName && <span className="mr-2">{audioFileName}</span>}
                  {corrections.length > 0
                    ? `${corrections.length}건 수정됨`
                    : '수정 내역 없음'}
                </p>
              </div>
              <button
                onClick={() => { clearAll(); setResumeAudio(null); }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0 mt-0.5"
              >
                삭제
              </button>
            </div>

            <FileUploader
              accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.mp4"
              label="오디오 파일 재업로드"
              icon="🎵"
              hint="이전에 사용했던 오디오 파일을 다시 올려주세요"
              onFile={(f) => {
                setResumeAudio(f);
                setError(null);
              }}
            />

            {error && (
              <p className="text-red-500 text-xs text-center mt-2">{error}</p>
            )}

            <button
              onClick={handleResume}
              disabled={!canResume}
              className={`w-full mt-3 py-2.5 rounded-xl font-semibold text-white text-sm transition-colors
                ${canResume
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-blue-300 cursor-not-allowed'
                }`}
            >
              이어하기 →
            </button>
          </div>
        )}

        {/* 새로 시작 */}
        <div className={hasSavedSession ? 'border-t border-gray-200 pt-6' : ''}>
          {hasSavedSession && (
            <p className="text-xs text-gray-400 text-center mb-4">또는 새 파일로 검수 시작</p>
          )}

          <div className="flex flex-col gap-4 mb-6">
            <FileUploader
              accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.mp4"
              label="오디오 파일"
              icon="🎵"
              hint="M4A, MP3, WAV 등 · 여기에 파일을 놓거나 클릭"
              onFile={(f) => {
                setLocalAudio(f);
                setError(null);
              }}
            />
            <FileUploader
              accept=".srt,.json"
              label="스크립트 파일 (SRT 또는 Whisper JSON)"
              icon="📄"
              hint=".srt 또는 .json (Whisper) · 여기에 파일을 놓거나 클릭"
              onFile={(f) => {
                setLocalScript(f);
                setError(null);
              }}
            />
          </div>

          {!hasSavedSession && error && (
            <p className="text-red-500 text-sm text-center mb-4">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-colors
              ${canStart
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 cursor-not-allowed'
              }`}
          >
            {hasSavedSession ? '새로 시작하기 →' : '검수 시작하기 →'}
          </button>
        </div>
      </div>
    </main>
  );
}
