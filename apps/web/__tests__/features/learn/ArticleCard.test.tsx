import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArticleCard } from '@/features/learn/ArticleCard';
import { ArticleSummary } from '@/lib/api/models';

describe('ArticleCard component', () => {
  const baseArticle: ArticleSummary = {
    id: 'art-1',
    slug: 'introducing-solids',
    title: 'Introducing Solids Safely',
    summary: 'A step-by-step guide to starting complementary foods.',
    category: 'Nutrition',
    kind: 'ARTICLE',
    ageMinMonths: 6,
    ageMaxMonths: 12,
    coverUrl: 'https://example.com/cover.jpg',
    status: 'PUBLISHED',
    readingTimeMinutes: 5,
    publishedAt: '2026-01-01T00:00:00.000Z',
  };

  it('renders title, summary, category chip, and age range label (6-12 months)', () => {
    render(<ArticleCard article={baseArticle} />);
    expect(screen.getByText('Introducing Solids Safely')).toBeInTheDocument();
    expect(
      screen.getByText('A step-by-step guide to starting complementary foods.')
    ).toBeInTheDocument();
    expect(screen.getByText('Nutrition')).toBeInTheDocument();
    expect(screen.getByText('6–12 months')).toBeInTheDocument();
  });

  it('links to /learn/<slug>', () => {
    render(<ArticleCard article={baseArticle} />);
    const link = screen.getByRole('link', { name: /Introducing Solids Safely/i });
    expect(link).toHaveAttribute('href', '/learn/introducing-solids');
  });

  it('renders cover image with alt="" and loading="lazy"', () => {
    const { container } = render(<ArticleCard article={baseArticle} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('formats open-ended minAge as "From X months"', () => {
    const article: ArticleSummary = {
      ...baseArticle,
      ageMinMonths: 12,
      ageMaxMonths: null,
    };
    render(<ArticleCard article={article} />);
    expect(screen.getByText('From 12 months')).toBeInTheDocument();
  });

  it('formats open-ended maxAge as "Up to X months"', () => {
    const article: ArticleSummary = {
      ...baseArticle,
      ageMinMonths: null,
      ageMaxMonths: 6,
    };
    render(<ArticleCard article={article} />);
    expect(screen.getByText('Up to 6 months')).toBeInTheDocument();
  });

  it('omits age label when both age bounds are null', () => {
    const article: ArticleSummary = {
      ...baseArticle,
      ageMinMonths: null,
      ageMaxMonths: null,
    };
    render(<ArticleCard article={article} />);
    expect(screen.queryByText(/months/i)).toBeNull();
  });
});
