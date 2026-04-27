'use client';

import { useRef, useState, useCallback } from 'react';

interface FileUploaderProps {
  accept: string;
  label: string;
  icon: string;
  hint: string;
  onFile: (file: File) => void;
}

export default function FileUploader({
  accept,
  label,
  icon,
  hint,
  onFile,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFile(file);
    },
    [onFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors text-center
        ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}
        ${fileName ? 'border-green-400 bg-green-50' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
      />

      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">✅</span>
          <p className="text-sm font-medium text-green-700">{fileName}</p>
          <p className="text-xs text-gray-500">클릭하여 다른 파일 선택</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">{icon}</span>
          <p className="font-medium text-gray-700">{label}</p>
          <p className="text-sm text-gray-400">{hint}</p>
        </div>
      )}
    </div>
  );
}
