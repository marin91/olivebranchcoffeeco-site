import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'submitted' | 'error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email)) {
      setStatus('error');
      return;
    }

    // No signup backend yet — this form only confirms the email looks valid.
    // Wire this up to an email service (or the Phase 1 API) before launch.
    setStatus('submitted');
  }

  if (status === 'submitted') {
    return <p className="text-sm text-cream-50">Thanks! We'll be in touch soon.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:gap-0">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (status === 'error') setStatus('idle');
        }}
        className="w-full rounded-full bg-olive-800 px-4 py-2 text-sm text-cream-50 placeholder:text-olive-300 focus:outline-none focus:ring-2 focus:ring-clay-500 sm:rounded-r-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-clay-500 px-5 py-2 text-sm font-medium text-cream-50 transition-colors hover:bg-clay-600 sm:rounded-l-none"
      >
        Sign up
      </button>
      {status === 'error' && (
        <p className="mt-2 text-xs text-clay-400 sm:absolute">Please enter a valid email address.</p>
      )}
    </form>
  );
}
