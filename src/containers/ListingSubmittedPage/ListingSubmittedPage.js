import React from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { LISTING_PAGE_PENDING_APPROVAL_VARIANT } from '../../util/urlHelpers';
import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H1, LayoutSingleColumn, NamedLink, Page } from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './ListingSubmittedPage.module.css';

const SuccessIcon = () => (
  <svg
    className={css.icon}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="32" cy="32" r="29" fill="none" strokeWidth="4" />
    <path
      d="M19 33.5l9 9 17-19"
      fill="none"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Confirmation page shown after a new ad has been submitted for review.
 *
 * @component
 * @returns {JSX.Element}
 */
const ListingSubmittedPage = () => {
  const intl = useIntl();
  const { id, slug } = useParams();
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));

  return (
    <Page
      title={intl.formatMessage({ id: 'ListingSubmittedPage.schemaTitle' })}
      scrollingDisabled={scrollingDisabled}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <main className={css.root}>
          <div className={css.content}>
            <SuccessIcon />
            <H1 rootClassName={css.heading}>
              <FormattedMessage id="ListingSubmittedPage.heading" />
            </H1>
            <p className={css.description}>
              <FormattedMessage id="ListingSubmittedPage.description" />
            </p>
            <div className={css.actions}>
              <NamedLink name="NewListingPage" className={css.primaryAction}>
                <FormattedMessage id="ListingSubmittedPage.postAnother" />
              </NamedLink>
              <NamedLink name="LandingPage" className={css.secondaryAction}>
                <FormattedMessage id="ListingSubmittedPage.goHome" />
              </NamedLink>
            </div>
            {id && slug ? (
              <NamedLink
                name="ListingPageVariant"
                params={{ id, slug, variant: LISTING_PAGE_PENDING_APPROVAL_VARIANT }}
                className={css.previewLink}
              >
                <FormattedMessage id="ListingSubmittedPage.preview" />
              </NamedLink>
            ) : null}
          </div>
        </main>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ListingSubmittedPage;
