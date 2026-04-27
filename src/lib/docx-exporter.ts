import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx';
import { SrtSegment, Correction } from '@/types';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCorrectionReport(
  segments: SrtSegment[],
  corrections: Correction[],
  filename: string
) {
  // 실제 수정/삭제만 필터 (단순 플래그 제외)
  const realCorrections = corrections.filter(
    (c) => c.corrected === null || c.corrected !== c.original
  );

  // ── 섹션 1: 수정 목록 ──────────────────────────────────────

  const listItems: Paragraph[] = realCorrections.map((c, i) => {
    const original = c.original;
    const corrected = c.corrected;

    if (corrected === null) {
      // 삭제
      return new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}.  `, size: 22 }),
          new TextRun({
            text: `"${original}"`,
            size: 22,
            strike: true,
            color: 'CC0000',
          }),
          new TextRun({ text: '  →  (삭제)', size: 22, color: '888888' }),
        ],
        spacing: { after: 80 },
      });
    } else {
      return new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}.  `, size: 22 }),
          new TextRun({ text: `"${original}"`, size: 22, color: '888888' }),
          new TextRun({ text: '  →  ', size: 22, color: '888888' }),
          new TextRun({ text: `"${corrected}"`, size: 22, bold: true, color: 'D97706' }),
        ],
        spacing: { after: 80 },
      });
    }
  });

  // ── 섹션 2: 수정 완료 스크립트 ───────────────────────────────

  const scriptParagraphs: Paragraph[] = segments.map((seg) => {
    const segCorrections = corrections.filter((c) => c.segmentIndex === seg.index);
    const runs: TextRun[] = [];

    // 화자 레이블
    if (seg.speaker) {
      runs.push(
        new TextRun({ text: `${seg.speaker}: `, size: 22, bold: true, color: '1D4ED8' })
      );
    }

    seg.words.forEach((word, wi) => {
      const correction = segCorrections.find((c) => c.wordIndex === wi);

      if (!correction) {
        // 수정 없음 - 일반 텍스트
        runs.push(new TextRun({ text: (wi > 0 ? ' ' : '') + word, size: 22 }));
      } else if (correction.corrected === null) {
        // 삭제된 단어 - 취소선 + 빨간색
        runs.push(
          new TextRun({
            text: (wi > 0 ? ' ' : '') + word,
            size: 22,
            strike: true,
            color: 'CC0000',
          })
        );
      } else if (correction.corrected === correction.original) {
        // 플래그만 (단순 선택) - 일반 텍스트
        runs.push(new TextRun({ text: (wi > 0 ? ' ' : '') + word, size: 22 }));
      } else {
        // 수정됨 - 노란 형광펜
        runs.push(
          new TextRun({
            text: (wi > 0 ? ' ' : '') + correction.corrected!,
            size: 22,
            shading: {
              type: ShadingType.CLEAR,
              fill: 'FEF08A',
            },
          })
        );
      }
    });

    return new Paragraph({
      children: runs,
      spacing: { after: 120 },
    });
  });

  // ── 문서 조립 ────────────────────────────────────────────────

  const doc = new Document({
    sections: [
      {
        children: [
          // 제목
          new Paragraph({
            text: '검수 보고서',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // 섹션 1 헤더
          new Paragraph({
            children: [
              new TextRun({
                text: `수정 목록  (총 ${realCorrections.length}건)`,
                bold: true,
                size: 26,
                color: '1F2937',
              }),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            },
            spacing: { before: 200, after: 200 },
          }),

          ...(realCorrections.length === 0
            ? [
                new Paragraph({
                  children: [new TextRun({ text: '수정 내역이 없습니다.', size: 22, color: '9CA3AF' })],
                  spacing: { after: 200 },
                }),
              ]
            : listItems),

          // 섹션 2 헤더
          new Paragraph({
            children: [
              new TextRun({
                text: '수정 완료 스크립트',
                bold: true,
                size: 26,
                color: '1F2937',
              }),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            },
            spacing: { before: 400, after: 200 },
          }),

          ...scriptParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const baseName = filename.replace(/\.[^.]+$/, '');
  saveBlob(blob, `${baseName}_검수보고서.docx`);
}
