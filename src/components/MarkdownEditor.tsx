'use client';

import { useState, useRef, type ChangeEvent } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Add a detailed description… (Markdown supported)',
  minHeight = '140px',
  disabled = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertFormatting(prefix: string, suffix: string = '', defaultText: string = '') {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end) || defaultText;

    const before = value.slice(0, start);
    const after = value.slice(end);

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = `${before}${replacement}${after}`;

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  }

  function renderSimpleMarkdown(content: string) {
    if (!content.trim()) {
      return <p className="italic text-slate-400 dark:text-slate-500">No description provided.</p>;
    }

    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
        {lines.map((line, idx) => {
          // Heading 1
          if (line.startsWith('# ')) {
            return (
              <h3 key={idx} className="pt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                {line.slice(2)}
              </h3>
            );
          }
          // Heading 2
          if (line.startsWith('## ')) {
            return (
              <h4 key={idx} className="pt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {line.slice(3)}
              </h4>
            );
          }
          // Checkbox unchecked
          if (line.startsWith('- [ ] ') || line.startsWith('* [ ] ')) {
            return (
              <div key={idx} className="flex items-center gap-2 pl-1">
                <input type="checkbox" disabled checked={false} className="h-3.5 w-3.5 rounded border-slate-300" />
                <span>{line.slice(6)}</span>
              </div>
            );
          }
          // Checkbox checked
          if (line.startsWith('- [x] ') || line.startsWith('* [x] ') || line.startsWith('- [X] ')) {
            return (
              <div key={idx} className="flex items-center gap-2 pl-1 text-slate-400 line-through dark:text-slate-500">
                <input type="checkbox" disabled checked={true} className="h-3.5 w-3.5 rounded text-brand-600" />
                <span>{line.slice(6)}</span>
              </div>
            );
          }
          // Bullet list
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-slate-400">•</span>
                <span>{line.slice(2)}</span>
              </div>
            );
          }
          // Blockquote
          if (line.startsWith('> ')) {
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-brand-500 pl-3 italic text-slate-600 dark:border-brand-400 dark:text-slate-400"
              >
                {line.slice(2)}
              </blockquote>
            );
          }
          // Empty line
          if (!line.trim()) {
            return <div key={idx} className="h-2" />;
          }

          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white transition-colors focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-800/60">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            title="Bold"
            onClick={() => insertFormatting('**', '**', 'bold text')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded p-1 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            B
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => insertFormatting('*', '*', 'italic text')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded p-1 text-xs italic text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            I
          </button>
          <span className="mx-1 h-3.5 w-px bg-slate-300 dark:bg-slate-700" />
          <button
            type="button"
            title="Heading"
            onClick={() => insertFormatting('## ', '', 'Heading')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded px-1.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            H
          </button>
          <button
            type="button"
            title="Bullet list"
            onClick={() => insertFormatting('- ', '', 'List item')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            • List
          </button>
          <button
            type="button"
            title="Checklist"
            onClick={() => insertFormatting('- [ ] ', '', 'Task item')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ☑ Check
          </button>
          <button
            type="button"
            title="Quote"
            onClick={() => insertFormatting('> ', '', 'Quote')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ” Quote
          </button>
          <button
            type="button"
            title="Inline Code"
            onClick={() => insertFormatting('`', '`', 'code')}
            disabled={mode === 'PREVIEW' || disabled}
            className="rounded px-1.5 py-1 font-mono text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            &lt;/&gt;
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('WRITE')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              mode === 'WRITE'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('PREVIEW')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              mode === 'PREVIEW'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      {mode === 'WRITE' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ minHeight }}
          className="w-full resize-y rounded-b-lg border-0 bg-transparent p-3 text-sm focus:outline-none focus:ring-0 dark:text-slate-200"
        />
      ) : (
        <div style={{ minHeight }} className="overflow-y-auto p-3">
          {renderSimpleMarkdown(value)}
        </div>
      )}
    </div>
  );
}

