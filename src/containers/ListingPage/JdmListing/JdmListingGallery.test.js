import React from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../../util/sdkLoader';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import JdmListingGallery from './JdmListingGallery';

const { UUID } = sdkTypes;
const { screen } = testingLibrary;

const image = i => ({
  id: new UUID(`image-${i}`),
  type: 'image',
  attributes: {
    variants: {
      'scaled-small': { name: 'scaled-small', width: 320, height: 240, url: `https://img/${i}` },
    },
  },
});
const listingWith = count => ({ images: Array.from({ length: count }, (_, i) => image(i)) });
const renderGallery = count =>
  render(
    <JdmListingGallery
      listing={listingWith(count)}
      title="S15"
      onManageDisableScrolling={() => {}}
    />
  );

describe('JdmListingGallery', () => {
  it('shows a placeholder without photos', () => {
    renderGallery(0);
    expect(screen.getByText('ListingPage.jdm.noPhotos')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows one photo without an "All photos" button', () => {
    renderGallery(1);
    expect(screen.getAllByRole('button', { name: 'ListingPage.jdm.openPhoto' })).toHaveLength(1);
    expect(screen.queryByText('ListingPage.jdm.allPhotos')).not.toBeInTheDocument();
  });

  it.each([2, 3, 4, 5, 6, 7])('lays out %i photos without empty cells', count => {
    const { container } = renderGallery(count);
    const tiles = screen.getAllByRole('button', { name: 'ListingPage.jdm.openPhoto' });
    expect(tiles).toHaveLength(count);
    expect(container.querySelector('[data-count]')).toHaveAttribute('data-count', `${count}`);
    expect(screen.getByRole('button', { name: 'ListingPage.jdm.allPhotos' })).toBeInTheDocument();
  });

  it('shows seven photos at most and opens the rest in the carousel', () => {
    const { container } = renderGallery(12);
    expect(screen.getAllByRole('button', { name: 'ListingPage.jdm.openPhoto' })).toHaveLength(7);
    expect(container.querySelector('[data-count]')).toHaveAttribute('data-count', '7');
  });
});
