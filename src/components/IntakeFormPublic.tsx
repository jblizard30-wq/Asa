'use client';

import { useState, type FormEvent } from 'react';
import { submitIntakeForm } from '@/lib/actions/intakeForms';

export interface PublicFormField {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'DATE' | 'SELECT';
  required: boolean;
  options: { id: string; label: string }[];
}

export function IntakeFormPublic({
  slug,
  name,
  description,
  fields,
}: {
  slug: string;
  name: string;
  description: string | null;
  fields: PublicFormField[];
}) {
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitIntakeForm(slug, { submitterName, submitterEmail, answers, honeypot });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl">✅</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900">Thank you!</h1>
          <p className="mt-1 text-sm text-slate-500">We&apos;ve received your request and will follow up soon.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{name}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            name="company"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <div>
            <label className="block text-xs font-medium text-slate-500">Your name *</label>
            <input
              required
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Email (optional)</label>
            <input
              type="email"
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {fields.map((f) => (
            <div key={f.id}>
              <label className="block text-xs font-medium text-slate-500">
                {f.label} {f.required && '*'}
              </label>
              {f.type === 'TEXTAREA' ? (
                <textarea
                  required={f.required}
                  rows={3}
                  value={answers[f.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              ) : f.type === 'SELECT' ? (
                <select
                  required={f.required}
                  value={answers[f.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Choose one…</option>
                  {f.options.map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'EMAIL' ? 'email' : f.type === 'DATE' ? 'date' : 'text'}
                  required={f.required}
                  value={answers[f.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              )}
            </div>
          ))}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </main>
  );
}
