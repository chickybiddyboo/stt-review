'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/FileUploader';
import { useReviewStore } from '@/stores/review-store';
import { parseSrt } from '@/lib/srt-parser';
import { parseWhisperJson, isWhisperJson } from '@/lib/whisper-parser';

export default function UploadPage() {
  const router = useRouter();
  const { setSegments, setAudioFile, setSrtFileName, clearAll } =
    useReviewStore();

  const [audioFile, setLocalAudio] = useState<File | null>(null);
  const [scriptFile, setLocalScript] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!audioFile || !scriptFile) {
      setError('오디오 파일과 스크립트 파일을 모두 업로드해주세요.');
      return;
    }

    try {
      clearAll();
      const text = await scriptFile.text();

      let segments;
      const isJson = scriptFile.name.endsWith('.json') || isWhisperJson(text);

      if (isJson) {
        segments = parseWhisperJson(text);
      } else {
        segments = parseSrt(text);
      }

      if (segments.length === 0) {
        setError('스크립트 파일을 파싱할 수 없습니다. 형식을 확인해주세요.');
        return;
      }

      setSegments(segments);
      setAudioFile(audioFile);
      setSrtFileName(scriptFile.name.replace(/\.(srt|json)$/i, '_corrected.srt'));

      router.push('/review');
    } catch {
      setError('파일 처리 중 오류가 발생했습니다.');
    }
  };

  const canStart = audioFile !== null && scriptFile !== null;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            STT 스크립트 검수 도구
          </h1>
          <p className="text-gray-500 text-sm">
            오디오 파일과 SRT 스크립트를 업로드하여 검수를 시작하세요
          </p>
        </div>

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

        {error && (
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
          검수 시작하기 →
        </button>
      </div>
    </main>
  );
}
