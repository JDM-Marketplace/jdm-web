import React, { useState } from 'react';
import classNames from 'classnames';
import loadable from '@loadable/component';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { Modal, ResponsiveImage } from '../../../components';

// The full-screen carousel (react-image-gallery) loads when it is first opened
const ImageCarousel = loadable(() =>
  import(/* webpackChunkName: "ImageCarousel" */ '../ImageCarousel/ImageCarousel')
);

import pageCss from '../ListingPage.module.css';
import css from './JdmListingGallery.module.css';

// The design shows the main photo and a 2 × 3 grid of six more
const MAX_TILES = 7;
const SCALED_VARIANTS = ['scaled-small', 'scaled-medium', 'scaled-large', 'scaled-xlarge'];
const ALL_PHOTOS_BUTTON_ID = 'jdmListingGalleryAllPhotos';
const tileId = index => `jdmListingGalleryTile${index}`;

const IconCamera = () => (
  <svg
    className={css.placeholderIcon}
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.5 4h-5L7.5 6.5H4.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3L14.5 4Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

/**
 * Photo mosaic of the JDM listing page (Miro "Listing Ad Page Template"): the main photo with
 * up to six more beside it, and "All photos (N)" opening the full-screen carousel. The grid is
 * chosen by the number of photos (the `data-count` attribute in CSS), so listings with fewer
 * photos than the design never show empty boxes. Without photos, a placeholder is shown.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.listing listing entity with images
 * @param {string} props.title listing title, the main photo's alt text
 * @param {Function} props.onManageDisableScrolling
 * @returns {JSX.Element}
 */
const JdmListingGallery = props => {
  const { listing, title, onManageDisableScrolling } = props;
  const intl = useIntl();
  // null when closed, otherwise the index of the photo the carousel opens at
  const [openAt, setOpenAt] = useState(null);
  const [returnFocusId, setReturnFocusId] = useState(ALL_PHOTOS_BUTTON_ID);

  const images = listing.images || [];
  const count = images.length;

  if (count === 0) {
    return (
      <div className={css.placeholder}>
        <IconCamera />
        <p className={css.placeholderText}>
          <FormattedMessage id="ListingPage.jdm.noPhotos" />
        </p>
      </div>
    );
  }

  const tiles = images.slice(0, MAX_TILES);
  const open = (index, focusId) => {
    setReturnFocusId(focusId);
    setOpenAt(index);
  };

  const tileCount = Math.min(count, MAX_TILES);

  return (
    <div className={css.root} data-count={tileCount}>
      <div className={css.mosaic} data-count={tileCount}>
        {tiles.map((image, index) => {
          const isMain = index === 0;
          return (
            <button
              key={image.id.uuid}
              id={tileId(index)}
              type="button"
              className={classNames(css.tile, { [css.mainTile]: isMain })}
              onClick={() => open(index, tileId(index))}
              aria-label={intl.formatMessage(
                { id: 'ListingPage.jdm.openPhoto' },
                { index: index + 1, count }
              )}
            >
              <ResponsiveImage
                rootClassName={classNames(css.image, { [css.imageContain]: count === 1 })}
                image={image}
                variants={SCALED_VARIANTS}
                alt={isMain ? title : ''}
                sizes={
                  isMain
                    ? count === 1
                      ? '(max-width: 767px) 100vw, 1140px'
                      : '(max-width: 767px) 100vw, 700px'
                    : '(max-width: 767px) 33vw, 240px'
                }
                {...(isMain ? { fetchpriority: 'high' } : { loading: 'lazy' })}
              />
            </button>
          );
        })}
      </div>
      {count > 1 ? (
        <button
          id={ALL_PHOTOS_BUTTON_ID}
          type="button"
          className={css.allPhotos}
          onClick={() => open(0, ALL_PHOTOS_BUTTON_ID)}
        >
          <FormattedMessage id="ListingPage.jdm.allPhotos" values={{ count }} />
        </button>
      ) : null}

      <Modal
        id="ListingPage.jdmImageCarousel"
        scrollLayerClassName={pageCss.carouselModalScrollLayer}
        containerClassName={pageCss.carouselModalContainer}
        lightCloseButton
        isOpen={openAt !== null}
        onClose={() => setOpenAt(null)}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
        focusElementId={returnFocusId}
      >
        {openAt !== null ? (
          <ImageCarousel images={images} imageVariants={SCALED_VARIANTS} startIndex={openAt} />
        ) : null}
      </Modal>
    </div>
  );
};

export default JdmListingGallery;
