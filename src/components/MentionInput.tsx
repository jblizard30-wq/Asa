'use client';

import { useRef, useState } from 'react';

export interface MentionCandidate {
  id: string;
  name: string;
}

/** A single-line comment box that shows an @-triggered autocomplete of project members. */
export function MentionInput({
  members,
  onSubmit,
}: {
  members: MentionCandidate[];
  onSubmit: (body: string, mentionedUserIds: string[]) => void;
}) {
  const [text, setText] = useState('');
  const [mentioned, setMentioned] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions =
    query !== null ? members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5) : [];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const pos = e.target.selectionStart ?? value.length;
    setText(value);
    setCursor(pos);

    // A mention only "counts" as long as its literal "@Name" text is still present.
    setMentioned((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        const m = members.find((mm) => mm.id === id);
        if (m && value.includes(`@${m.name}`)) next.add(id);
      });
      return next;
    });

    const upToCursor = value.slice(0, pos);
    const match = /@([\w .'-]*)$/.exec(upToCursor);
    setQuery(match ? match[1] : null);
  }

  function selectMention(member: MentionCandidate) {
    const upToCursor = text.slice(0, cursor);
    const afterCursor = text.slice(cursor);
    const replaced = upToCursor.replace(/@([\w .'-]*)$/, `@${member.name} `);
    setText(replaced + afterCursor);
    setMentioned((prev) => new Set(prev).add(member.id));
    setQuery(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(replaced.length, replaced.length);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSubmit(body, [...mentioned]);
    setText('');
    setMentioned(new Set());
    setQuery(null);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <div className="relative w-full">
        <input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery(null);
          }}
          placeholder="Write a comment… use @ to mention someone"
          required
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {query !== null && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => selectMention(m)}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
              >
                @{m.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Post
      </button>
    </form>
  );
}
