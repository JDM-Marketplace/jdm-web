import React, { useEffect } from 'react';
import classNames from 'classnames';

// Import util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT } from '../../../../util/types';
import { LISTING_PAGE_PARAM_TYPE_NEW } from '../../../../util/urlHelpers';
import { pickCategoryFields } from '../../../../util/fieldHelpers';
import {
  displayDescription,
  displayPrice,
  getListingImageMaxCount,
  requireListingImage,
} from '../../../../util/configHelpers';

// Import shared components
import { H1, ListingLink } from '../../../../components';

// Import modules from this directory
import {
  getTransactionInfo,
  hasSetListingType,
  initialValuesForListingFields,
  pickListingFieldsData,
  setNoAvailabilityForUnbookableListings,
} from '../EditListingDetailsPanel/EditListingDetailsPanel';
import ErrorMessage from '../EditListingDetailsPanel/ErrorMessage';
import EditListingAdForm from './EditListingAdForm';
import css from './EditListingAdPanel.module.css';

const getInitialValues = params => {
  const {
    listing,
    images,
    locationSearch,
    existingListingTypeInfo,
    listingTypes,
    listingFields,
    listingCategories,
    categoryKey,
  } = params;
  const { description, title, price, publicData, privateData } = listing?.attributes || {};
  const preselectedListingType = locationSearch?.listingType;
  const listingType = publicData?.listingType || preselectedListingType;

  const savedCategories = pickCategoryFields(publicData || {}, categoryKey, 1, listingCategories);
  // New ads start with the first ad type selected (JDM Cars), like in the design.
  const hasSavedCategory = Object.keys(savedCategories).length > 0;
  const nestedCategories =
    hasSavedCategory || listingCategories.length === 0
      ? savedCategories
      : { [`${categoryKey}1`]: listingCategories[0].id };

  return {
    title,
    description,
    price,
    images,
    ...nestedCategories,
    ...getTransactionInfo({ listingTypes, existingListingTypeInfo, preselectedListingType }),
    ...initialValuesForListingFields(
      publicData,
      'public',
      listingType,
      nestedCategories,
      listingFields
    ),
    ...initialValuesForListingFields(
      privateData,
      'private',
      listingType,
      nestedCategories,
      listingFields
    ),
  };
};

/**
 * Single-page panel for creating and editing an ad. It replaces the template's separate
 * Details, Location, Pricing and Photos tabs with one form and one submit.
 *
 * @component
 * @param {Object} props
 * @returns {JSX.Element}
 */
const EditListingAdPanel = props => {
  const {
    rootClassName,
    params: pathParams,
    locationSearch,
    listing,
    images,
    disabled,
    ready,
    onSubmit,
    onListingTypeChange,
    onImageUpload,
    onRemoveImage,
    panelUpdated,
    updateInProgress,
    errors,
    config,
    listingImageConfig,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  const { publicData, state } = listing?.attributes || {};
  const listingTypes = config.listing.listingTypes;
  const listingFields = config.listing.listingFields;
  const listingCategories = config.categoryConfiguration.categories || [];
  const categoryKey = config.categoryConfiguration.key;

  const { hasExistingListingType, existingListingTypeInfo } = hasSetListingType(publicData || {});
  const hasValidExistingListingType =
    hasExistingListingType &&
    !!listingTypes.find(
      conf =>
        conf.listingType === existingListingTypeInfo.listingType &&
        conf.transactionType?.unitType === existingListingTypeInfo.unitType
    );

  const validPreselectedListingType =
    pathParams?.type === LISTING_PAGE_PARAM_TYPE_NEW && !!locationSearch?.listingType
      ? listingTypes.find(conf => conf.listingType === locationSearch.listingType)
      : null;

  // Select the correct listing type on initialization when it comes from the URL.
  useEffect(() => {
    if (!hasExistingListingType && validPreselectedListingType && onListingTypeChange) {
      onListingTypeChange(validPreselectedListingType);
    }
  }, []);

  const initialValues = getInitialValues({
    listing,
    images,
    locationSearch,
    existingListingTypeInfo,
    listingTypes,
    listingFields,
    listingCategories,
    categoryKey,
  });

  const selectedListingType = initialValues.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === selectedListingType);
  const maxImages = getListingImageMaxCount(listingTypeConfig);
  // Respect the listing type's default listing fields (Console > Listing types).
  const showPrice = displayPrice(listingTypeConfig);
  const showDescription = displayDescription(listingTypeConfig);
  const showPhotos = requireListingImage(listingTypeConfig);

  const hasListingTypesSet = listingTypes?.length > 0;
  const canShowForm =
    hasListingTypesSet && (!hasExistingListingType || hasValidExistingListingType);
  const isPublished = listing?.id && state !== LISTING_STATE_DRAFT;

  const headingId = isPublished ? 'EditListingAdPanel.editTitle' : 'EditListingAdPanel.title';
  const submitButtonText = intl.formatMessage({
    id: isPublished ? 'EditListingAdPanel.saveChanges' : 'EditListingAdPanel.submit',
  });

  const handleSubmit = values => {
    const {
      title,
      description,
      price,
      images: submittedImages,
      listingType,
      transactionProcessAlias,
      unitType,
      addImage,
      ...rest
    } = values;

    const nestedCategories = pickCategoryFields(rest, categoryKey, 1, listingCategories);
    // Remove old categories by explicitly saving null for them.
    const cleanedNestedCategories = {
      ...[1, 2, 3].reduce((a, i) => ({ ...a, [`${categoryKey}${i}`]: null }), {}),
      ...nestedCategories,
    };
    // Fields that don't belong to the selected listing type / category are saved as null.
    const publicListingFields = pickListingFieldsData(
      rest,
      'public',
      listingType,
      nestedCategories,
      listingFields
    );
    const privateListingFields = pickListingFieldsData(
      rest,
      'private',
      listingType,
      nestedCategories,
      listingFields
    );
    const descriptionMaybe = showDescription ? { description: (description || '').trim() } : {};
    const priceMaybe = showPrice ? { price } : {};
    const imagesMaybe = showPhotos ? { images: submittedImages } : {};

    onSubmit({
      title: title.trim(),
      ...descriptionMaybe,
      ...priceMaybe,
      ...imagesMaybe,
      publicData: {
        listingType,
        transactionProcessAlias,
        unitType,
        ...cleanedNestedCategories,
        ...publicListingFields,
      },
      privateData: privateListingFields,
      ...setNoAvailabilityForUnbookableListings(transactionProcessAlias),
    });
  };

  return (
    <main className={classNames(rootClassName || css.root)}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: headingId },
          { listingTitle: listing?.attributes?.title || '' }
        )}
      />
      <header className={css.header}>
        <H1 rootClassName={css.title}>
          <FormattedMessage
            id={headingId}
            values={{ listingTitle: isPublished ? <ListingLink listing={listing} /> : null }}
          />
        </H1>
        {isPublished ? null : (
          <>
            <p className={css.intro}>
              <FormattedMessage id="EditListingAdPanel.requiredInfo" />
            </p>
            <p className={css.intro}>
              <FormattedMessage id="EditListingAdPanel.reviewInfo" />
            </p>
          </>
        )}
      </header>

      {canShowForm ? (
        <EditListingAdForm
          className={css.form}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          saveActionMsg={submitButtonText}
          selectableListingTypes={listingTypes.map(conf =>
            getTransactionInfo({
              listingTypes: [conf],
              existingListingTypeInfo: {},
              includeLabel: true,
            })
          )}
          hasPredefinedListingType={hasExistingListingType || !!validPreselectedListingType}
          onListingTypeChange={onListingTypeChange}
          selectableCategories={listingCategories}
          categoryPrefix={categoryKey}
          listingFieldsConfig={listingFields}
          currency={listing?.attributes?.price?.currency || config.currency}
          listingMinimumPriceSubUnits={config.listingMinimumPriceSubUnits}
          images={images}
          onImageUpload={onImageUpload}
          onRemoveImage={onRemoveImage}
          listingImageConfig={listingImageConfig}
          maxImages={maxImages}
          showPrice={showPrice}
          showDescription={showDescription}
          showPhotos={showPhotos}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={errors}
        />
      ) : (
        <ErrorMessage
          marketplaceName={config.marketplaceName}
          noListingTypesSet={!hasListingTypesSet}
          invalidExistingListingType={!hasValidExistingListingType}
        />
      )}
    </main>
  );
};

export default EditListingAdPanel;
