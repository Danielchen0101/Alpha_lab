import React, { KeyboardEvent, useEffect, useState } from 'react';

export interface PublicTabItem {
  id: string;
  label: React.ReactNode;
}

interface PublicTabListProps {
  id: string;
  items: PublicTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export const publicTabIds = (listId: string, itemId: string) => ({
  tabId: `${safeId(listId)}-tab-${safeId(itemId)}`,
  panelId: `${safeId(listId)}-panel-${safeId(itemId)}`,
});

export const scrollPublicTarget = (target: Element | null) => {
  if (!target) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
};

export const PublicTabList: React.FC<PublicTabListProps> = ({
  id,
  items,
  activeId,
  onChange,
  ariaLabel,
  className,
  orientation = 'horizontal',
}) => {
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId));
  const [resolvedOrientation, setResolvedOrientation] = useState(orientation);

  useEffect(() => {
    if (orientation !== 'vertical') {
      setResolvedOrientation(orientation);
      return undefined;
    }
    const media = window.matchMedia('(max-width: 1020px)');
    const updateOrientation = () => setResolvedOrientation(media.matches ? 'horizontal' : 'vertical');
    updateOrientation();
    media.addEventListener('change', updateOrientation);
    return () => media.removeEventListener('change', updateOrientation);
  }, [orientation]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const previousKey = resolvedOrientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = resolvedOrientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    let nextIndex = activeIndex;

    if (event.key === previousKey) nextIndex = (activeIndex - 1 + items.length) % items.length;
    else if (event.key === nextKey) nextIndex = (activeIndex + 1) % items.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    onChange(nextItem.id);
    window.requestAnimationFrame(() => document.getElementById(publicTabIds(id, nextItem.id).tabId)?.focus());
  };

  return (
    <div
      className={className}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={resolvedOrientation}
      onKeyDown={handleKeyDown}
    >
      {items.map(item => {
        const selected = item.id === activeId;
        const ids = publicTabIds(id, item.id);
        return (
          <button
            key={item.id}
            id={ids.tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={ids.panelId}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'is-active' : undefined}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
