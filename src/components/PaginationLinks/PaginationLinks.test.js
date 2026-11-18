import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { fakeIntl } from '../../util/testData';

import PaginationLinks from './PaginationLinks';

const { screen } = testingLibrary;

describe('PaginationLinks', () => {
  const props = pagination => ({
    pageName: 'SearchPage',
    pagePathParams: {},
    pageSearchParams: { param: 'foobar' },
    pagination,
    intl: fakeIntl,
  });

  // This is quite small component what comes to rendered HTML
  // For now, we rely on snapshot-testing and checking the existence of next & prev buttons.
  it('should match snapshot with both links enabled', () => {
    const pagination = {
      page: 2,
      perPage: 10,
      totalItems: 30,
      totalPages: 3,
    };
    const tree = render(<PaginationLinks {...props(pagination)} />);
    expect(screen.queryByTitle('PaginationLinks.previous')).toBeInTheDocument();
    expect(screen.queryByTitle('PaginationLinks.next')).toBeInTheDocument();
    expect(tree.asFragment().firstChild).toMatchSnapshot();
  });

  it('should match snapshot with both links disabled', () => {
    const pagination = {
      page: 1,
      perPage: 10,
      totalItems: 10,
      totalPages: 1,
    };
    const tree = render(<PaginationLinks {...props(pagination)} />);
    expect(screen.queryByTitle('PaginationLinks.previous')).not.toBeInTheDocument();
    expect(screen.queryByTitle('PaginationLinks.next')).not.toBeInTheDocument();
    expect(tree.asFragment().firstChild).toMatchSnapshot();
  });

  it('should match snapshot with prev disabled and next enabled', () => {
    const pagination = {
      page: 1,
      perPage: 10,
      totalItems: 30,
      totalPages: 3,
    };
    const tree = render(<PaginationLinks {...props(pagination)} />);
    expect(screen.queryByTitle('PaginationLinks.previous')).not.toBeInTheDocument();
    expect(screen.queryByTitle('PaginationLinks.next')).toBeInTheDocument();
    expect(tree.asFragment().firstChild).toMatchSnapshot();
  });

  it('should match snapshot with prev enabled and next disabled', () => {
    const pagination = {
      page: 3,
      perPage: 10,
      totalItems: 30,
      totalPages: 3,
    };
    const tree = render(<PaginationLinks {...props(pagination)} />);
    expect(screen.queryByTitle('PaginationLinks.previous')).toBeInTheDocument();
    expect(screen.queryByTitle('PaginationLinks.next')).not.toBeInTheDocument();
    expect(tree.asFragment().firstChild).toMatchSnapshot();
  });
  it('shows Back, "Page X of Y" and Next in compact mode', () => {
    const pagination = { page: 2, perPage: 10, totalItems: 30, totalPages: 3 };
    render(<PaginationLinks {...props(pagination)} compact aria-label="Pages" />);
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByText('PaginationLinks.pageOf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PaginationLinks.back' })).toHaveAttribute(
      'href',
      '/s?page=1&param=foobar'
    );
    expect(screen.getByRole('link', { name: 'PaginationLinks.nextPage' })).toHaveAttribute(
      'href',
      '/s?page=3&param=foobar'
    );
  });

  it('shows no Back link on the first page in compact mode', () => {
    const pagination = { page: 1, perPage: 10, totalItems: 30, totalPages: 3 };
    render(<PaginationLinks {...props(pagination)} compact />);
    expect(screen.queryByRole('link', { name: 'PaginationLinks.back' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PaginationLinks.nextPage' })).toBeInTheDocument();
  });
});
