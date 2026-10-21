'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import StatusPill from './StatusPill';
import { fetchJson, getMode, hardNavigate, subscribeMode } from '@/lib/client';
import { rankItems } from '@/lib/fuzzy';
import { toggleTheme } from '@/lib/theme';

/**
 * ⌘K / Ctrl+K anywhere: jump to any project, open its live site, or run an
 * app action — without touching the mouse. Also owns the other global
 * shortcuts (`?` for help, `t` for theme) so there is one keyboard handler,
 * not one per component.
 */

const SHORTCUTS = [
  { keys: ['⌘', 'K'], alt: 'Ctrl K', what: 'Command palette — jump to a project or run an action' },
  { keys: ['/'], what: 'Filter projects on the dashboard' },
  { keys: ['t'], what: 'Toggle light / dark theme' },
  { keys: ['?'], what: 'Show these shortcuts' },
  { keys: ['⌘', 'S'], alt: 'Ctrl S', what: 'Commit the open file (Code tab)' },
  { keys: ['Esc'], what: 'Close a dialog' },
];

// The project list is shared with the dashboard's poll, but the palette can
// open on any page — so it keeps its own short-lived copy.
let cache = { at: 0, projects: null };

function typing(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

export default function CommandPalette() {
  const router = useRouter();
  const mode = useSyncExternalStore(subscribeMode, getMode, () => null);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState(cache.projects);
  const [loadError, setLoadError] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const returnFocus = useRef(null);

  const openPalette = useCallback(() => {
    returnFocus.current = document.activeElement;
    setQuery('');
    setActive(0);
    setHelp(false);
    setOpen(true);
    if (!cache.projects || Date.now() - cache.at > 30000) {
      fetchJson('/api/vercel/projects')
        .then((data) => {
          cache = { at: Date.now(), projects: data.projects || [] };
          setProjects(cache.projects);
          setLoadError(null);
        })
        .catch((error) => setLoadError(error));
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setHelp(false);
    returnFocus.current?.focus?.();
  }, []);

  // One global key handler for every shortcut.
  useEffect(() => {
    function onKey(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (open) close();
        else openPalette();
        return;
      }
      if (event.key === 'Escape' && (open || help)) {
        event.preventDefault();
        close();
        return;
      }
      if (mod || event.altKey || typing(event.target) || open) return;
      if (event.key === '?') {
        event.preventDefault();
        returnFocus.current = document.activeElement;
        setHelp((value) => !value);
      } else if (event.key === 't') {
        toggleTheme();
      }
    }
    window.addEventListener('keydown', onKey);
    // The top bar's search button asks for the palette through an event, so it
    // needs no shared state with this component.
    window.addEventListener('devdeck:palette', openPalette);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('devdeck:palette', openPalette);
    };
  }, [open, help, close, openPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const items = useMemo(() => {
    const list = [];
    for (const project of projects || []) {
      list.push({
        id: `p-${project.id}`,
        kind: 'project',
        label: project.name,
        detail: project.repo ? `${project.repo.owner}/${project.repo.name}` : project.framework || 'no git repo',
        status: project.status,
        keys: [project.name, project.repo ? `${project.repo.owner}/${project.repo.name}` : '', project.framework || ''],
        run: () => router.push(`/project/${encodeURIComponent(project.id)}`),
      });
    }
    const actions = [
      { id: 'a-home', label: 'Go to dashboard', detail: 'All projects', run: () => router.push('/') },
      { id: 'a-theme', label: 'Toggle theme', detail: 'Light / dark · t', run: toggleTheme },
      { id: 'a-keys', label: 'Keyboard shortcuts', detail: '?', run: () => setHelp(true), keepOpen: true },
      { id: 'a-build', label: 'How DevDeck was built', detail: 'The build story', run: () => router.push('/about-project') },
      { id: 'a-about', label: 'About the developer', detail: 'Charan Reddy', run: () => router.push('/about') },
    ];
    if (mode === 'demo') {
      actions.push({
        id: 'a-exit',
        label: 'Exit demo',
        detail: 'Back to the setup guide',
        run: () => fetchJson('/api/demo', { method: 'DELETE' }).then(() => hardNavigate('/')).catch(() => {}),
      });
    }
    for (const action of actions) list.push({ kind: 'action', keys: [action.label, action.detail], ...action });
    // Only offer "open site" once someone types — eleven of them would drown the list.
    if (query.trim()) {
      for (const project of projects || []) {
        if (!project.productionUrl) continue;
        list.push({
          id: `s-${project.id}`,
          kind: 'link',
          label: `Open ${project.name} site`,
          detail: project.productionUrl.replace(/^https?:\/\//, ''),
          keys: [`open ${project.name}`, `${project.name} site`],
          run: () => window.open(project.productionUrl, '_blank', 'noopener'),
        });
      }
    }
    return rankItems(list, query, (item) => item.keys);
  }, [projects, query, mode, router]);

  // Keep the highlighted row valid as the list shrinks, and in view.
  const current = Math.min(active, Math.max(items.length - 1, 0));
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function choose(item) {
    if (!item) return;
    if (!item.keepOpen) close();
    item.run();
  }

  function onInputKey(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current + 1) % Math.max(items.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(items[current]);
    } else if (event.key === 'Tab') {
      event.preventDefault(); // a modal dialog keeps focus on its input
    }
  }

  if (!open && !help) return null;

  if (help && !open) {
    return (
      <div className="overlay" onMouseDown={close}>
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="keys-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="dialog-head">
            <h2 id="keys-title">Keyboard shortcuts</h2>
            <button type="button" className="icon-btn" onClick={close} aria-label="Close" autoFocus>
              ✕
            </button>
          </div>
          <ShortcutList />
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onMouseDown={close}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <span className="search-icon" aria-hidden="true">
            &#8981;
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Jump to a project, or type a command…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[current] ? `pi-${items[current].id}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>

        {help ? (
          <ShortcutList />
        ) : (
          <ul className="palette-list" id="palette-list" role="listbox" ref={listRef} aria-label="Results">
            {projects === null && !loadError ? <li className="palette-empty">Loading projects…</li> : null}
            {loadError ? <li className="palette-empty">Projects unavailable: {loadError.message}</li> : null}
            {items.length === 0 && projects !== null ? <li className="palette-empty">Nothing matches “{query}”.</li> : null}
            {items.map((item, index) => (
              <li
                key={item.id}
                id={`pi-${item.id}`}
                data-index={index}
                role="option"
                aria-selected={index === current}
                className="palette-item"
                onMouseMove={() => index !== current && setActive(index)}
                onClick={() => choose(item)}
              >
                <span className={`palette-kind kind-${item.kind}`} aria-hidden="true">
                  {item.kind === 'project' ? '▲' : item.kind === 'link' ? '↗' : '›'}
                </span>
                <span className="palette-label">{item.label}</span>
                <span className="palette-detail">{item.detail}</span>
                {item.status ? <StatusPill status={item.status} /> : null}
              </li>
            ))}
          </ul>
        )}

        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span className="topbar-spacer" />
          <button type="button" className="link-button" onClick={() => setHelp((value) => !value)}>
            {help ? 'Back to results' : 'All shortcuts ?'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutList() {
  return (
    <ul className="shortcut-list">
      {SHORTCUTS.map((shortcut) => (
        <li key={shortcut.what}>
          <span className="shortcut-keys">
            {shortcut.keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
            {shortcut.alt ? <span className="faint mono"> / {shortcut.alt}</span> : null}
          </span>
          <span>{shortcut.what}</span>
        </li>
      ))}
    </ul>
  );
}

/** The top-bar trigger: looks like a search field, opens the palette. */
export function PaletteButton() {
  return (
    <button
      type="button"
      className="palette-trigger"
      onClick={() => window.dispatchEvent(new Event('devdeck:palette'))}
      aria-label="Open command palette"
    >
      <span aria-hidden="true">&#8981;</span>
      <span className="palette-trigger-text">Search projects &amp; actions</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
