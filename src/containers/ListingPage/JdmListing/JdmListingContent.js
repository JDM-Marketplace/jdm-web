import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { LISTING_STATE_CLOSED } from '../../../util/types';
import { formatMoney } from '../../../util/currency';
import { richText } from '../../../util/richText';
import {
  BODY_TYPE_FIELD_KEY,
  CONDITION_FIELD_KEY,
  DRIVE_TYPE_FIELD_KEY,
  MAKE_FIELD_KEY,
  MODEL_FIELD_KEY,
  ODOMETER_FIELD_KEY,
  PART_MAKE_FIELD_KEY,
  STATE_FIELD_KEY,
  TRANSMISSION_FIELD_KEY,
  YEAR_FIELD_KEY,
  getJdmListingSpecs,
} from '../../../util/jdmFields';
import { jdmSeoBasePath, jdmSeoPageMeta } from '../../../util/jdmSearchUrls';
import { AvatarMedium, NamedLink, PrimaryButton } from '../../../components';

import JdmSeoHeader from '../../SearchPage/JdmSeoHeader/JdmSeoHeader';
import JdmListingGallery from './JdmListingGallery';
import SectionSimilarListings from './SectionSimilarListings';

import css from './JdmListing.module.css';

const SPEC_LABEL_IDS = {
  [MAKE_FIELD_KEY]: 'ListingPage.jdm.specMake',
  [PART_MAKE_FIELD_KEY]: 'ListingPage.jdm.specMake',
  [MODEL_FIELD_KEY]: 'ListingPage.jdm.specModel',
  [YEAR_FIELD_KEY]: 'ListingPage.jdm.specYear',
  [STATE_FIELD_KEY]: 'ListingPage.jdm.specLocation',
  [TRANSMISSION_FIELD_KEY]: 'ListingPage.jdm.specTransmission',
  [BODY_TYPE_FIELD_KEY]: 'ListingPage.jdm.specBodyType',
  [DRIVE_TYPE_FIELD_KEY]: 'ListingPage.jdm.specDriveType',
  [ODOMETER_FIELD_KEY]: 'ListingPage.jdm.specOdometer',
  [CONDITION_FIELD_KEY]: 'ListingPage.jdm.specCondition',
};

/**
 * Price, seller and "Message Seller" in the red-bordered box under the photos.
 */
const PriceBox = props => {
  const { price, author, authorDisplayName, isOwnListing, isClosed, onMessageSeller } = props;
  const intl = useIntl();
  const formattedPrice = price ? formatMoney(intl, price) : null;
  const authorId = author?.id?.uuid;

  return (
    <div className={css.priceBox}>
      {formattedPrice ? (
        <p className={css.price}>
          <span className={css.visuallyHidden}>
            <FormattedMessage id="ListingPage.jdm.priceLabel" />{' '}
          </span>
          {formattedPrice}
        </p>
      ) : null}
      <div className={css.sellerAndAction}>
        <div className={css.seller}>
          <AvatarMedium className={css.sellerAvatar} user={author} disableProfileLink />
          <div className={css.sellerText}>
            <span className={css.sellerLabel}>
              <FormattedMessage id="ListingPage.jdm.seller" />
            </span>
            {authorId ? (
              <NamedLink className={css.sellerName} name="ProfilePage" params={{ id: authorId }}>
                {authorDisplayName}
              </NamedLink>
            ) : (
              <span className={css.sellerName}>{authorDisplayName}</span>
            )}
          </div>
        </div>
        {isClosed ? (
          <p className={css.actionNote}>
            <FormattedMessage id="ListingPage.closedListing" />
          </p>
        ) : (
          <div className={css.action}>
            <PrimaryButton
              className={css.messageButton}
              type="button"
              onClick={onMessageSeller}
              disabled={isOwnListing}
            >
              <span>
                <FormattedMessage id="ListingPage.jdm.messageSeller" />
              </span>
              <svg
                className={css.messageIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
              </svg>
            </PrimaryButton>
            {isOwnListing ? (
              <p className={css.actionNote}>
                <FormattedMessage id="ListingPage.ownListing" />
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Specs as a list (client: "can you make these <li>"), Make and Model linking to their search
 * pages. Two columns on desktop, filled top to bottom like the design.
 */
const SectionSpecs = props => {
  const { specs, linkPaths } = props;
  if (specs.length === 0) {
    return null;
  }
  const rows = Math.ceil(specs.length / 2);
  return (
    <section className={css.section} aria-labelledby="listing-specs-heading">
      <h2 id="listing-specs-heading" className={css.sectionHeading}>
        <FormattedMessage id="ListingPage.jdm.specsTitle" />
      </h2>
      <ul className={css.specs} style={{ '--specRows': rows }}>
        {specs.map(({ key, value }) => {
          const path = linkPaths[key];
          return (
            <li key={key} className={css.spec}>
              <span className={css.specLabel}>
                <FormattedMessage id={SPEC_LABEL_IDS[key]} />
              </span>
              {path ? (
                <Link to={path} className={css.specLink}>
                  {value}
                </Link>
              ) : (
                <span className={css.specValue}>{value}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * Listing page of JDM cars and parts (Miro "Listing Ad Page Template"): breadcrumbs, the title
 * (h1), photos, price and seller, specs, the description and similar listings.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.listing current listing
 * @param {Object} props.seoPage result of jdmSeoPageForListing for the listing
 * @param {string} props.listingPath path of this page, the last breadcrumb
 * @param {Object} props.config marketplace config
 * @param {ReactNode} props.actionBar own listing / closed listing notifications
 * @param {Object} props.author listing author (ensured user)
 * @param {string} props.authorDisplayName
 * @param {boolean} props.isOwnListing
 * @param {Function} props.onMessageSeller starts the inquiry
 * @param {Function} props.onManageDisableScrolling
 * @param {Object} props.similarListings { listings, fetchedForId, inProgress, error }
 * @param {Function} props.onFetchSimilarListings called with (listing, config)
 * @returns {JSX.Element}
 */
const JdmListingContent = props => {
  const {
    listing,
    seoPage,
    listingPath,
    config,
    actionBar,
    author,
    authorDisplayName,
    isOwnListing,
    onMessageSeller,
    onManageDisableScrolling,
    similarListings,
    onFetchSimilarListings,
  } = props;
  const intl = useIntl();
  const { title = '', description = '', price, publicData = {}, state } = listing.attributes;
  const listingFields = config.listing?.listingFields || [];

  const { breadcrumbs: seoCrumbs, heading: seoHeading } = jdmSeoPageMeta(
    seoPage,
    intl,
    config.marketplaceName
  );
  const breadcrumbs = [...seoCrumbs, { label: title, path: listingPath }];

  const specs = getJdmListingSpecs(publicData, listingFields, km =>
    intl.formatMessage({ id: 'ListingCard.odometer' }, { km: intl.formatNumber(km) })
  );
  const { make, model, partMake } = seoPage;
  const linkPaths = {
    ...(make ? { [MAKE_FIELD_KEY]: jdmSeoBasePath({ ...seoPage, model: null }) } : {}),
    ...(model ? { [MODEL_FIELD_KEY]: jdmSeoBasePath(seoPage) } : {}),
    ...(partMake ? { [PART_MAKE_FIELD_KEY]: jdmSeoBasePath(seoPage) } : {}),
  };

  // "See all" goes to the make / model page, the empty state to the whole category
  const hasMakePage = !!(make || partMake);
  const seeAll = hasMakePage ? { label: seoHeading, path: jdmSeoBasePath(seoPage) } : null;
  const browseAll = seoCrumbs[1] || null;

  const onFetchSimilar = useCallback(() => onFetchSimilarListings(listing, config), [
    onFetchSimilarListings,
    listing,
    config,
  ]);

  return (
    <div className={css.root}>
      {actionBar}
      <JdmSeoHeader
        className={css.header}
        headingClassName={css.title}
        heading={title}
        breadcrumbs={breadcrumbs}
      />

      <JdmListingGallery
        listing={listing}
        title={title}
        onManageDisableScrolling={onManageDisableScrolling}
      />

      <PriceBox
        price={price}
        author={author}
        authorDisplayName={authorDisplayName}
        isOwnListing={isOwnListing}
        isClosed={state === LISTING_STATE_CLOSED}
        onMessageSeller={onMessageSeller}
      />

      <SectionSpecs specs={specs} linkPaths={linkPaths} />

      {description ? (
        <section className={css.section} aria-labelledby="listing-description-heading">
          <h2 id="listing-description-heading" className={css.sectionHeading}>
            <FormattedMessage id="ListingPage.jdm.descriptionTitle" />
          </h2>
          <p className={css.description}>
            {richText(description, { longWordMinLength: 20, longWordClass: css.longWord })}
          </p>
        </section>
      ) : null}

      <SectionSimilarListings
        key={listing.id.uuid}
        listingId={listing.id.uuid}
        listings={similarListings.listings}
        fetchedForId={similarListings.fetchedForId}
        inProgress={similarListings.inProgress}
        error={similarListings.error}
        onFetch={onFetchSimilar}
        seeAll={seeAll}
        browseAll={browseAll}
      />
    </div>
  );
};

export default JdmListingContent;
