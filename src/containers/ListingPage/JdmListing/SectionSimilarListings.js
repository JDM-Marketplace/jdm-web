import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { FormattedMessage } from '../../../util/reactIntl';
import { ListingCard } from '../../../components';

import css from './JdmListing.module.css';

// Start loading a little before the section is on screen, so the cards are usually ready
const ROOT_MARGIN = '300px 0px';
const PLACEHOLDER_COUNT = 4;

/**
 * True once the element has come near the viewport. Without IntersectionObserver (old browsers)
 * it is true straight away, so the section still loads.
 *
 * @param {Object} ref React ref of the element
 * @returns {boolean}
 */
const useNearViewport = ref => {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsNear(true);
      return undefined;
    }
    const observer = new window.IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isNear;
};

/**
 * The part of the section below its heading: placeholders while waiting, an error with a retry,
 * an empty state pointing to the category, or the cards.
 */
const SimilarListingsBody = props => {
  const { status, listings, onFetch, browseAll } = props;

  if (status === 'waiting') {
    return (
      <ul className={css.similarGrid} aria-hidden="true">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <li key={i} className={css.similarPlaceholder} />
        ))}
      </ul>
    );
  }

  if (status === 'error') {
    return (
      <div className={css.similarMessage}>
        <p className={css.similarMessageText}>
          <FormattedMessage id="ListingPage.jdm.similarError" />
        </p>
        <button type="button" className={css.retryButton} onClick={onFetch}>
          <FormattedMessage id="ListingPage.jdm.similarRetry" />
        </button>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className={css.similarMessage}>
        <p className={css.similarMessageText}>
          <FormattedMessage id="ListingPage.jdm.similarEmpty" />
        </p>
        {browseAll ? (
          <Link to={browseAll.path} className={css.seeAllLink}>
            <FormattedMessage
              id="ListingPage.jdm.similarBrowseAll"
              values={{ name: browseAll.label }}
            />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className={css.similarGrid}>
      {listings.map(l => (
        <li key={l.id.uuid} className={css.similarItem}>
          <ListingCard
            listing={l}
            renderSizes="(max-width: 549px) 100vw, (max-width: 1023px) 50vw, 280px"
          />
        </li>
      ))}
    </ul>
  );
};

/**
 * Where the similar listings are: not fetched yet or loading ("waiting"), failed, none or loaded.
 */
const similarStatus = ({ isForThisListing, inProgress, error, count }) =>
  !isForThisListing || inProgress ? 'waiting' : error ? 'error' : count === 0 ? 'empty' : 'loaded';

/**
 * "Similar Listings" of the JDM listing page: listings with the same make and model (cars) or
 * part make (parts), two rows of four on desktop. Nothing is fetched until the section comes
 * near the viewport; until then, and while loading, grey placeholder cards keep its height.
 * Render it with key={listingId}, so moving to another listing watches the viewport again.
 *
 * @component
 * @param {Object} props
 * @param {string} props.listingId uuid of the listing on the page
 * @param {Array<Object>} props.listings similar listings (empty until fetched)
 * @param {string|null} props.fetchedForId uuid of the listing the similar listings belong to
 * @param {boolean} props.inProgress
 * @param {Object|null} props.error
 * @param {Function} props.onFetch fetches the similar listings of this listing
 * @param {{ label: string, path: string }|null} props.seeAll the search page of this make/model
 * @param {{ label: string, path: string }|null} props.browseAll the category page, for the empty state
 * @returns {JSX.Element}
 */
const SectionSimilarListings = props => {
  const {
    listingId,
    listings,
    fetchedForId,
    inProgress,
    error,
    onFetch,
    seeAll,
    browseAll,
  } = props;
  const sectionRef = useRef(null);
  const isNear = useNearViewport(sectionRef);
  const isForThisListing = fetchedForId === listingId;

  useEffect(() => {
    if (isNear && !isForThisListing) {
      onFetch();
    }
  }, [isNear, isForThisListing, onFetch]);

  const status = similarStatus({ isForThisListing, inProgress, error, count: listings.length });

  return (
    <section
      ref={sectionRef}
      className={css.similarSection}
      aria-labelledby="similar-listings-heading"
    >
      <div className={css.similarHeader}>
        <h2 id="similar-listings-heading" className={css.similarHeading}>
          <FormattedMessage id="ListingPage.jdm.similarTitle" />
        </h2>
        {seeAll && status !== 'empty' ? (
          <Link to={seeAll.path} className={css.seeAllLink}>
            <FormattedMessage id="ListingPage.jdm.similarSeeAll" values={{ name: seeAll.label }} />
          </Link>
        ) : null}
      </div>

      <div aria-busy={status === 'waiting'}>
        <SimilarListingsBody
          status={status}
          listings={listings}
          onFetch={onFetch}
          browseAll={browseAll}
        />
      </div>
    </section>
  );
};

export default SectionSimilarListings;
