import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArticleSuggestions } from './ArticleSuggestions';
import * as useActiveChildModule from '@/features/children/useActiveChild';
import * as useArticlesModule from './useArticles';

vi.mock('@/features/children/useActiveChild');
vi.mock('./useArticles');

describe('ArticleSuggestions', () => {
  it('renders nothing when loading or has no items', () => {
    vi.mocked(useActiveChildModule.useActiveChild).mockReturnValue({
      children: [],
      activeChild: null,
      activeChildId: null,
      setActiveChildId: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useArticlesModule.useArticles).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useArticlesModule.useArticles>);

    const { container } = render(<ArticleSuggestions />);
    expect(container.firstChild).toBeNull();
  });

  it('renders reading recommendations when articles are available', () => {
    vi.mocked(useActiveChildModule.useActiveChild).mockReturnValue({
      children: [],
      activeChild: {
        id: 'c1',
        name: 'Maya',
        dateOfBirth: '2024-01-01',
        ageMonths: 14,
        gender: 'FEMALE',
        heightCm: 78,
        weightKg: 10,
        activityLevel: 'MODERATE',
        dietType: 'NON_VEGETARIAN',
        photoUrl: null,
        allergies: [],
        conditions: [],
        dislikes: [],
      },
      activeChildId: 'c1',
      setActiveChildId: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useArticlesModule.useArticles).mockReturnValue({
      data: {
        items: [
          {
            id: 'art-1',
            slug: 'finger-foods',
            title: 'Finger Foods for Toddlers',
            summary: 'Safe textures to try.',
            category: 'Safety',
            kind: 'ARTICLE',
            ageMinMonths: 12,
            ageMaxMonths: 24,
            coverUrl: null,
            status: 'PUBLISHED',
            readingTimeMinutes: 3,
            publishedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 3,
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useArticlesModule.useArticles>);

    render(<ArticleSuggestions />);
    expect(screen.getByText('Reading for Maya')).toBeInTheDocument();
    expect(screen.getByText('Finger Foods for Toddlers')).toBeInTheDocument();
  });
});
