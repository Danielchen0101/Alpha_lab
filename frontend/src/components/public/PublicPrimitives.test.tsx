/* eslint-disable testing-library/no-unnecessary-act -- this test uses React's low-level createRoot API */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PublicCta, PublicHero } from './PublicPrimitives';

describe('public navigation primitives', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.scrollTo = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  });

  it('uses links for route changes while retaining a button for the hero action', async () => {
    const onSecondary = jest.fn();
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PublicHero
            eyebrow="Research"
            index="01"
            title="Test"
            subtitle="Test subtitle"
            primaryLabel="Create account"
            secondaryLabel="Inspect section"
            onSecondary={onSecondary}
          >
            <div>Visual</div>
          </PublicHero>
          <PublicCta
            eyebrow="Next"
            title="Continue"
            description="Continue research"
            primary="Get started"
            secondary="Browse examples"
            secondaryPath="/examples"
          />
        </MemoryRouter>,
      );
    });

    const heroPrimary = container.querySelector<HTMLAnchorElement>('.public-hero a.public-primary');
    const heroSecondary = container.querySelector<HTMLButtonElement>('.public-hero button.public-secondary');
    const ctaPrimary = container.querySelector<HTMLAnchorElement>('.public-cta a.public-primary');
    const ctaSecondary = container.querySelector<HTMLAnchorElement>('.public-cta a.public-secondary');
    expect(heroPrimary?.getAttribute('href')).toBe('/signup');
    expect(heroSecondary?.tagName).toBe('BUTTON');
    expect(ctaPrimary?.getAttribute('href')).toBe('/signup');
    expect(ctaSecondary?.getAttribute('href')).toBe('/examples');

    await act(async () => heroSecondary?.click());
    expect(onSecondary).toHaveBeenCalledTimes(1);

    await act(async () => ctaSecondary?.click());
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
