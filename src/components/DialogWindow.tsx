'use client';

import { useState, useEffect, useRef } from 'react';
import type { Window } from '@/state/store';

interface DialogWindowProps {
  window: Window;
  title: string;
  message?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  showInput?: boolean;
}

export default function DialogWindow({
  window,
  title,
  message,
  inputLabel,
  inputPlaceholder,
  inputValue: initialValue = '',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showInput = false,
}: DialogWindowProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showInput]);

  const handleConfirm = () => {
    if (showInput && !inputValue.trim()) {
      return; // Don't confirm if input is required but empty
    }
    onConfirm(showInput ? inputValue.trim() : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="h-full w-full flex flex-col p-4"
      style={{ backgroundColor: '#e6f2ff' }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white border-2 border-gray-400 rounded p-4 shadow-lg max-w-md mx-auto">
        {/* Title */}
        <h3 className="text-lg font-bold mb-3 text-gray-800">{title}</h3>

        {/* Message */}
        {message && (
          <p className="text-sm text-gray-700 mb-4">{message}</p>
        )}

        {/* Input */}
        {showInput && (
          <div className="mb-4">
            {inputLabel && (
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {inputLabel}:
              </label>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          {cancelText && cancelText.trim() && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-900 rounded hover:bg-gray-300 border border-gray-400"
              style={{
                boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={showInput && !inputValue.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-700"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

