import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatTile } from '@/features/dashboard/StatTile';

describe('StatTile component', () => {
  it('renders label and value formatted with thousands separator', () => {
    render(<StatTile label="Total Users" value={1234} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders hint as secondary text when provided', () => {
    render(<StatTile label="Disabled Accounts" value={5} hint="Policy violations" />);
    expect(screen.getByText('Policy violations')).toBeInTheDocument();
  });
});
