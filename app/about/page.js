import Link from 'next/link';
import ContactCard from '@/components/ContactCard';
import { profile, project } from '@/lib/profile';

export const metadata = {
  title: 'About',
  description: `${profile.name} — ${profile.role} in ${profile.location}. ${profile.tagline}`,
  alternates: { canonical: '/about' },
};

const LEARNINGS = [
  {
    title: 'Every API lies about its error codes until you test it',
    body: "Vercel answers 403 for an invalid token, not 401. I had written the setup guide to trigger on 401 — which meant the single most common first-run failure would have shown a vague permissions banner instead of the instructions that fix it. I only found it by pointing a deliberately garbage token at the real API. Reading docs is not testing.",
  },
  {
    title: 'Where the token lives is architecture, not configuration',
    body: 'Every external call goes through a route handler, so the browser never holds a credential and never talks to api.vercel.com directly. That one decision removed CORS, kept the tokens out of the client bundle, and gave every error in the app a single shape to travel in. Getting it right on day one costs nothing; retrofitting it costs a rewrite.',
  },
  {
    title: 'Parsing is where the bugs actually hide',
    body: "Vercel's build-log endpoint returns a JSON array or newline-delimited JSON depending on the deployment's state, and the text arrives full of ANSI colour codes. My first strip regex was missing its escape anchor, so a log line reading \"branch [main] is up to date\" came out as \"branch ain] is up to date\". There is now a test pinning that exact string.",
  },
  {
    title: 'Auto-scroll is a promise you can break',
    body: 'Live-tailing a build log is the whole point of watching a deploy. But following the tail while someone is scrolled up reading the error that just flew past is worse than not tailing at all. The fix is four lines: only follow if the reader is already parked at the bottom.',
  },
  {
    title: 'Building for one honest user beats building for an imaginary crowd',
    body: 'I built this because I was the person clicking through a dozen tabs to answer "is that thing still up?" — so every feature had an immediate, unforgiving test: did it stop me doing the annoying thing? Nothing shipped because it would look good in a README. That is a much better filter than it sounds.',
  },
];

export default function AboutPage() {
  return (
    <div className="content">
      <header className="page-hero">
        <div className="eyebrow">About</div>
        <h1 className="display-title">{profile.name}</h1>
        <div className="detail-links" style={{ marginTop: 14 }}>
          <span className="link-chip">{profile.role}</span>
          <span className="link-chip">{profile.location}</span>
          <a className="link-chip" href={profile.socials.orcid} target="_blank" rel="noreferrer">
            ORCID &#8599;
          </a>
        </div>
        <p className="lede">{profile.tagline}</p>
      </header>

      <section className="section prose">
        <p>
          I&apos;m an AI engineer in Bangalore. Most of my work is the unglamorous half of machine learning — the part
          where something that looks like magic in a notebook has to survive contact with real traffic, real latency,
          and real people who will not read your error message.
        </p>
        <p>
          The highlights: a Springer-published model that reads chest X-rays well enough for a radiologist to take
          seriously, and document pipelines that run themselves. Before any of that I wrote real-time control code for
          jet engines at DRDO, where a millisecond of lag isn&apos;t a bug — it&apos;s a flameout. That job permanently
          changed what I think &quot;done&quot; means.
        </p>
        <p>
          DevDeck is a much smaller thing than a jet engine. It is a dashboard I built because I was tired of a
          question I couldn&apos;t answer quickly: <strong>is that project still up?</strong>
        </p>
      </section>

      <div className="callout">
        <span className="callout-rail" aria-hidden="true" />
        <p>
          This is one project. There are twenty more — and a few jet engines — over at{' '}
          <a href={profile.url} target="_blank" rel="noreferrer">
            charanreddy.dev
          </a>
          .
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">What I learned building this</h2>
        <div className="section-kicker">five things I did not know in February</div>

        <ol className="learnings">
          {LEARNINGS.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section prose">
        <h2 className="section-title">Elsewhere</h2>
        <div className="detail-links" style={{ marginTop: 12 }}>
          <a className="link-chip" href={profile.socials.github} target="_blank" rel="noreferrer">
            GitHub &#8599;
          </a>
          <a className="link-chip" href={profile.socials.linkedin} target="_blank" rel="noreferrer">
            LinkedIn &#8599;
          </a>
          <a className="link-chip" href={profile.socials.cal} target="_blank" rel="noreferrer">
            Book a call &#8599;
          </a>
          <a className="link-chip" href={profile.url} target="_blank" rel="noreferrer">
            Portfolio &#8599;
          </a>
          <a className="link-chip" href={project.repo} target="_blank" rel="noreferrer">
            This repo &#8599;
          </a>
        </div>
        <p style={{ marginTop: 20 }}>
          Curious how this one was built? The{' '}
          <Link href="/about-project">story behind DevDeck</Link> has the timeline, the decisions, and the week it all
          broke.
        </p>
      </section>

      <ContactCard />
    </div>
  );
}
