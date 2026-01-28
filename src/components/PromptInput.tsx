import { useState, useRef, KeyboardEvent } from 'react';
import { useMount } from 'react-use';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

export function PromptInput({
  onSubmit,
  onCancel,
  placeholder = 'Describe any UI (e.g., "login form with email and password")',
}: PromptInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount using react-use
  useMount(() => {
    inputRef.current?.focus();
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      onSubmit(value.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div 
      className="prompt-input flex flex-col gap-3"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-3 text-sm text-gray-900 bg-gray-100 border-2 border-gray-200 rounded-lg outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-gray-400"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-500 bg-transparent border border-gray-200 rounded-md transition-colors hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Press Enter to generate, Escape to cancel
      </p>
    </div>
  );
}
