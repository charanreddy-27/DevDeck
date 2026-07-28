'use client';

import { useState } from 'react';
import { useToast } from './ToastProvider';
import { profile } from '@/lib/profile';

/**
 * DevDeck has no database and no server-side mail, and adding either just to
 * catch a contact form would be dishonest architecture. The form composes a
 * real email in the visitor's own client instead — no backend, nothing to leak.
 */
export default function ContactCard() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function onSubmit(event) {
    event.preventDefault();

    if (!name.trim() || !message.trim()) {
      toast.error('A name and a message would help.');
      return;
    }

    const subject = `DevDeck — message from ${name.trim()}`;
    const body = [message.trim(), '', '—', name.trim(), email.trim()].filter(Boolean).join('\n');
    const href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
    toast.success('Opening your mail app with the message ready to send.', { title: 'Almost there' });
  }

  return (
    <section className="contact-card" id="contact" aria-labelledby="contact-heading">
      <h2 className="contact-head" id="contact-heading">
        Have an idea? Let&apos;s talk.
      </h2>
      <p className="contact-sub">
        Want to build something — or break something interesting? I read everything that lands here. The fastest route
        is booking 30 minutes; the form works too.
      </p>

      <div className="contact-actions">
        <a className="btn btn-primary" href={profile.socials.cal} target="_blank" rel="noreferrer">
          Book a call
        </a>
        <a className="btn" href={`mailto:${profile.email}`}>
          Email
        </a>
        <a className="btn" href={profile.socials.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="btn" href={profile.socials.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a className="btn" href={profile.resumeUrl} target="_blank" rel="noreferrer">
          Resume
        </a>
      </div>

      <form className="contact-form" onSubmit={onSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="cf-name">Name</label>
            <input
              id="cf-name"
              className="input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cf-email">Email</label>
            <input
              id="cf-email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="cf-message">Message</label>
          <textarea
            id="cf-message"
            className="input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What are you building?"
            required
          />
        </div>

        <div className="form-foot">
          <button type="submit" className="btn btn-primary">
            Send message
          </button>
          <span className="availability">
            <span className="live-dot" aria-hidden="true" />
            Available for new projects
          </span>
          <div className="topbar-spacer" />
          <span className="faint mono" style={{ fontSize: 11 }}>
            opens your mail app · no server, no database
          </span>
        </div>
      </form>
    </section>
  );
}
