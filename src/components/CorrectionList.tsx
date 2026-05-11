'use client';

import { useState } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { downloadCorrectionReport } from '@/lib/docx-exporter';

export default function CorrectionList() {
  const { corrections, segments, srtFileName, setActivePanel, removeCorrection, setActiveSegmentIndex } = useReviewStore();
  const [showSaveModal, setShowSaveModal] = useState(false);

  // C-6: 클릭 시 스크립트 스크롤만 — 오디오 이동 없음
  const handleCorrectionClick = (segmentIndex: number) => {
    const arrayIdx = segments.findIndex((s) => s.index === segmentIndex);
    if (arrayIdx === -1) return;
    setActiveSegmentIndex(arrayIdx);
    setActivePanel('corrections');
  };

  const handleDownloadReport = () => {
    downloadCorrectionReport(segments, corrections, srtFileName);
  };

  // C-7: 스크립트 순(segmentIndex → wordIndex) 정렬
  const sortedCorrections = [...corrections].sort((a, b) => {
    if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
    return a.wordIndex - b.wordIndex;
  });

  return (
    <div
      className="flex flex-col h-full"
      onClick={() => setActivePanel('corrections')}
    >
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">
          검수 목록{' '}
          <span className="text-gray-400 font-normal">({corrections.length}건)</span>
        </h2>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {sortedCorrections.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-xs text-center px-4">
            수정 내역이 없습니다.
            <br />
            어절을 클릭하여 수정하세요.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedCorrections.map((c, i) => (
              <li
                key={i}
                className="group px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleCorrectionClick(c.segmentIndex)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {c.corrected === null ? (
                      <div className="text-sm">
                        <span className="line-through text-gray-400">{c.original}</span>
                        <span className="text-xs text-gray-500 ml-1">[삭제됨]</span>
                      </div>
                    ) : c.corrected === c.original ? (
                      <div className="text-sm text-gray-400">{c.original}</div>
                    ) : (
                      <div className="text-sm flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-500">{c.original}</span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="text-orange-600 font-medium">{c.corrected}</span>
                      </div>
                    )}
                    {c.reviewNote && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 flex-shrink-0">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                          <line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                        <span className="text-xs text-amber-600 leading-tight">{c.reviewNote}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCorrection(c.segmentIndex, c.wordIndex); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 mt-0.5"
                    title="삭제"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="1" y1="1" x2="9" y2="9"/>
                      <line x1="9" y1="1" x2="1" y2="9"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowSaveModal(true); }}
          disabled={corrections.length === 0}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            corrections.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          검수 내용 저장
        </button>
      </div>

      {/* 저장 확인 모달 */}
      {showSaveModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 mb-1">검수 내용을 저장하시겠습니까?</p>
            <p className="text-xs text-gray-400 mb-5">
              {corrections.length}건의 수정 내역이 DOCX 파일로 저장됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { handleDownloadReport(); setShowSaveModal(false); }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                저장합니다
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
