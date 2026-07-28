'use client';

import { memo, useMemo, useState } from 'react';
import { cx, formatBytes } from '@/lib/format';

/** Turns a flat list of blob paths into a nested directory structure. */
function buildTree(files) {
  const root = { name: '', path: '', type: 'dir', children: new Map() };

  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');

      if (index === parts.length - 1) {
        node.children.set(part, { ...file, name: part, path, type: 'file' });
        return;
      }

      const existing = node.children.get(part);
      if (!existing || existing.type !== 'dir') {
        node.children.set(part, { name: part, path, type: 'dir', children: new Map() });
      }
      node = node.children.get(part);
    });
  }

  return sortNode(root);
}

/** Directories first, then files, each alphabetical. */
function sortNode(node) {
  if (node.type !== 'dir') return node;
  const children = [...node.children.values()].map(sortNode);
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { ...node, children };
}

function TreeNode({ node, depth, expanded, onToggle, selectedPath, onSelect }) {
  if (node.type === 'file') {
    return (
      <button
        type="button"
        className={cx('tree-item', node.tooLarge && 'is-disabled')}
        style={{ paddingLeft: 10 + depth * 13 }}
        aria-current={selectedPath === node.path}
        disabled={node.tooLarge}
        title={node.tooLarge ? `${node.path} — larger than 1 MB, not editable here` : node.path}
        onClick={() => onSelect(node)}
      >
        <span className="tw" aria-hidden="true" />
        <span className="tn">{node.name}</span>
        <span className="tsz">{formatBytes(node.size)}</span>
      </button>
    );
  }

  const isOpen = expanded.has(node.path);

  return (
    <>
      <button
        type="button"
        className="tree-item is-dir"
        style={{ paddingLeft: 10 + depth * 13 }}
        aria-expanded={isOpen}
        onClick={() => onToggle(node.path)}
        title={node.path}
      >
        <span className={cx('tw', 'chevron', isOpen && 'open')} aria-hidden="true">
          &#9656;
        </span>
        <span className="tn">{node.name}</span>
      </button>

      {isOpen
        ? node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

/**
 * Memoized: the editor re-renders on every keystroke, and a repo tree can hold
 * thousands of nodes. Requires a stable `onSelect` from the parent.
 */
function FileTree({ files, selectedPath, onSelect }) {
  const [query, setQuery] = useState('');
  // Top-level directories start open so the tree is never a wall of folders.
  const [expanded, setExpanded] = useState(() => {
    const roots = new Set();
    for (const file of files) {
      const [first] = file.path.split('/');
      if (file.path.includes('/')) roots.add(first);
    }
    return new Set([...roots].slice(0, 3));
  });

  const tree = useMemo(() => buildTree(files), [files]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return files.filter((file) => file.path.toLowerCase().includes(needle)).slice(0, 300);
  }, [files, query]);

  function toggle(path) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="panel tree-panel">
      <div className="tree-search">
        <input
          className="input"
          type="search"
          placeholder={`Find in ${files.length} files`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Find a file"
        />
      </div>

      <div className="tree-scroll">
        {matches ? (
          matches.length ? (
            matches.map((file) => (
              <button
                key={file.path}
                type="button"
                className={cx('tree-item', file.tooLarge && 'is-disabled')}
                aria-current={selectedPath === file.path}
                disabled={file.tooLarge}
                title={file.path}
                onClick={() => onSelect(file)}
              >
                <span className="tn">{file.path}</span>
              </button>
            ))
          ) : (
            <div className="muted mono" style={{ padding: '10px 12px', fontSize: 12 }}>
              No file matches.
            </div>
          )
        ) : (
          tree.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(FileTree);
