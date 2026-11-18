import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { types as sdkTypes, createImageVariantConfig } from '../../util/sdkLoader';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { transactionLineItems } from '../../util/api';
import * as log from '../../util/log';
import { denormalisedResponseEntities } from '../../util/data';
import {
  bookingTimeUnits,
  findNextBoundary,
  getStartOf,
  monthIdString,
  stringifyDateToISO8601,
} from '../../util/dates';
import {
  hasPermissionToInitiateTransactions,
  hasPermissionToViewData,
  isUserAuthorized,
} from '../../util/userHelpers';
import {
  LISTING_PAGE_DRAFT_VARIANT,
  LISTING_PAGE_PENDING_APPROVAL_VARIANT,
} from '../../util/urlHelpers';
import {
  getProcess,
  isBookingProcessAlias,
  isNegotiationProcessAlias,
  OFFER,
} from '../../transactions/transaction';
import { fetchCurrentUser, setCurrentUserHasOrders } from '../../ducks/user.duck';
import { JDM_CARD_PUBLIC_DATA_FIELDS } from '../../util/jdmFields';
import { jdmSeoPageForListing } from '../../util/jdmSearchUrls';

const { UUID } = sdkTypes;
const MINUTE_IN_MS = 1000 * 60;

// Day-based time slots queries are cached for 1 minute.
const removeOutdatedDateData = timeSlotsForDate => {
  const now = new Date().getTime();
  const minuteAgo = now - MINUTE_IN_MS;
  return Object.fromEntries(
    Object.entries(timeSlotsForDate).filter(([dateId, data]) => {
      return data.fetchedAt && data.fetchedAt > minuteAgo;
    })
  );
};

/**
 * Image query params for listings.show / ownListings.show.
 * SSR uses a lean set (2 images, SEO + LCP variants) so crawlers
 * cannot harvest every attached image URL from __PRELOADED_STATE__.
 * The webapp (CSR) fetches the full image list.
 *
 * Two images (not one) keeps react-image-gallery in infinite mode from the first
 * paint, so growing 2→N on CSR does not flash an unloaded last-image clone.
 *
 * @param {Object} listingImageConfig
 * @param {string} [listingImageConfig.variantPrefix='listing-card']
 * @param {number} listingImageConfig.aspectRatio
 * @param {boolean} [isBrowser=typeof window !== 'undefined']
 * @returns {Object} fields.image, optional limit.images, and imageVariant.* configs
 */
export const getShowListingImageParams = (
  { variantPrefix = 'listing-card', aspectRatio },
  isBrowser = typeof window !== 'undefined'
) => {
  const socialAndAvatarFields = [
    'variants.facebook',
    'variants.twitter',
    'variants.square-small',
    'variants.square-small2x',
  ];

  if (!isBrowser) {
    // Lean SSR: first two images + variants needed for hero LCP, og/twitter, schema,
    // and the base listing-card crop. That crop must be present so react-image-gallery
    // gets a truthy `thumbnail` and reserves the thumb-strip height (avoids CLS when
    // the client remount loadData adds the rest of the gallery).
    return {
      'fields.image': [
        'variants.scaled-small',
        'variants.scaled-medium',
        'variants.scaled-large',
        'variants.scaled-xlarge',
        `variants.${variantPrefix}`,
        `variants.${variantPrefix}-2x`,
        ...socialAndAvatarFields,
      ],
      'limit.images': 2,
      ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
      ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    };
  }

  return {
    'fields.image': [
      'variants.scaled-small',
      'variants.scaled-medium',
      'variants.scaled-large',
      'variants.scaled-xlarge',
      `variants.${variantPrefix}`,
      `variants.${variantPrefix}-2x`,
      `variants.${variantPrefix}-4x`,
      `variants.${variantPrefix}-6x`,
      ...socialAndAvatarFields,
    ],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-4x`, 1600, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-6x`, 2400, aspectRatio),
  };
};

// ================ Async Thunks ================ //

//////////////////
// Show Listing //
//////////////////
const showListingPayloadCreator = ({ listingId, config, isOwn = false }, thunkAPI) => {
  const { dispatch, rejectWithValue, extra: sdk } = thunkAPI;
  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = config.layout.listingImage;
  const aspectRatio = aspectHeight / aspectWidth;

  // Current user entity is fetched in a bit lazy fashion, since it's not tied to returned Promise chain.
  const fetchCurrentUserOptions = {
    updateHasListings: false,
    updateNotifications: false,
  };
  dispatch(fetchCurrentUser(fetchCurrentUserOptions));

  const params = {
    id: listingId,
    include: ['author', 'author.profileImage', 'images', 'currentStock'],
    ...getShowListingImageParams({ variantPrefix, aspectRatio }),
  };

  const show = isOwn ? sdk.ownListings.show(params) : sdk.listings.show(params);

  return show
    .then(data => {
      const listingFields = config?.listing?.listingFields;
      const sanitizeConfig = { listingFields };
      dispatch(addMarketplaceEntities(data, sanitizeConfig));
      return data;
    })
    .catch(e => {
      return rejectWithValue(storableError(e));
    });
};

export const showListingThunk = createAsyncThunk(
  'ListingPage/showListing',
  showListingPayloadCreator
);
// Backward compatible wrapper for the thunk
export const showListing = (listingId, config, isOwn = false) => (dispatch, getState, sdk) => {
  return dispatch(showListingThunk({ listingId, config, isOwn })).unwrap();
};

///////////////////
// Fetch Reviews //
///////////////////
export const fetchReviewsThunk = createAsyncThunk(
  'ListingPage/fetchReviews',
  ({ listingId }, { rejectWithValue, extra: sdk }) => {
    return sdk.reviews
      .query({
        listing_id: listingId,
        state: 'public',
        include: ['author', 'author.profileImage'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
      })
      .then(response => {
        return denormalisedResponseEntities(response);
      })
      .catch(e => {
        return rejectWithValue(storableError(e));
      });
  }
);

export const fetchReviews = listingId => (dispatch, getState, sdk) => {
  return dispatch(fetchReviewsThunk({ listingId })).unwrap();
};

//////////////////////
// Fetch Time Slots //
//////////////////////

const timeSlotsRequest = createAsyncThunk(
  'ListingPage/timeSlotsRequest',
  (params, { extra: sdk }) => {
    return sdk.timeslots.query(params).then(response => {
      return denormalisedResponseEntities(response);
    });
  }
);

const fetchTimeSlotsPayloadCreator = ({ listingId, start, end, timeZone, options }, thunkAPI) => {
  const { dispatch, getState } = thunkAPI;
  const { extraQueryParams = null, useFetchTimeSlotsForDate = false } = options || {};

  // The maximum pagination page size for timeSlots is 500
  const extraParams = extraQueryParams || {
    perPage: 500,
    page: 1,
  };

  // For small time units, we fetch the data per date.
  // This is to avoid fetching too much data (with 15 minute intervals, there can be 24*4*31 = 2928 time slots)
  if (useFetchTimeSlotsForDate) {
    const dateId = stringifyDateToISO8601(start, timeZone);
    const dateData = getState().ListingPage.timeSlotsForDate[dateId];
    const minuteAgo = new Date().getTime() - MINUTE_IN_MS;
    const hasRecentlyFetchedData = dateData?.fetchedAt > minuteAgo;
    if (hasRecentlyFetchedData) {
      return Promise.resolve(dateData?.timeSlots || []);
    }

    return dispatch(timeSlotsRequest({ listingId, start, end, ...extraParams }))
      .then(response => {
        return response.payload;
      })
      .catch(e => {
        return [];
      });
  } else {
    return dispatch(timeSlotsRequest({ listingId, start, end, ...extraParams }))
      .then(response => {
        return response.payload;
      })
      .catch(e => {
        return [];
      });
  }
};

export const fetchTimeSlotsThunk = createAsyncThunk(
  'ListingPage/fetchTimeSlots',
  fetchTimeSlotsPayloadCreator
);
// Backward compatible wrapper for the thunk
export const fetchTimeSlots = (listingId, start, end, timeZone, options) => (
  dispatch,
  getState,
  sdk
) => {
  return dispatch(fetchTimeSlotsThunk({ listingId, start, end, timeZone, options })).unwrap();
};

//////////////////
// Send Inquiry //
//////////////////
const sendInquiryPayloadCreator = (
  { listing, message },
  { dispatch, rejectWithValue, extra: sdk }
) => {
  const processAlias = listing?.attributes?.publicData?.transactionProcessAlias;
  if (!processAlias) {
    const error = new Error('No transaction process attached to listing');
    log.error(error, 'listing-process-missing', {
      listingId: listing?.id?.uuid,
    });
    return rejectWithValue(storableError(error));
  }

  const listingId = listing?.id;
  const [processName, alias] = processAlias.split('/');

  // Negotiation process does not support inquiry for customer role on OFFER flog (only request for quote is supported)
  const isNegotiationProcess = isNegotiationProcessAlias(processAlias);
  const unitType = listing?.attributes?.publicData?.unitType || '';
  if (isNegotiationProcess && unitType === OFFER) {
    return rejectWithValue(
      storableError(
        new Error(
          'Negotiation process with unit type OFFER does not support inquiry for customer role'
        )
      )
    );
  }

  const transitions = getProcess(processName)?.transitions;

  const bodyParams = {
    transition: transitions.INQUIRE,
    processAlias,
    params: { listingId },
  };
  return sdk.transactions
    .initiate(bodyParams)
    .then(response => {
      const transactionId = response.data.data.id;

      // Send the message to the created transaction
      return sdk.messages.send({ transactionId, content: message }).then(() => {
        dispatch(setCurrentUserHasOrders());
        return transactionId;
      });
    })
    .catch(e => {
      return rejectWithValue(storableError(e));
    });
};

export const sendInquiryThunk = createAsyncThunk(
  'ListingPage/sendInquiry',
  sendInquiryPayloadCreator
);
// Backward compatible wrapper for the thunk
export const sendInquiry = (listing, message) => (dispatch, getState, sdk) => {
  return dispatch(sendInquiryThunk({ listing, message })).unwrap();
};

// Helper function for loadData call.
// Note: listing could be ownListing entity too
const fetchMonthlyTimeSlots = (dispatch, listing) => {
  const hasWindow = typeof window !== 'undefined';
  const { availabilityPlan, publicData } = listing?.attributes || {};
  const tz = availabilityPlan?.timezone;

  // Fetch time-zones on client side only.
  if (hasWindow && listing.id && !!tz) {
    const { unitType, priceVariants, startTimeInterval } = publicData || {};
    const now = new Date();
    const startOfToday = getStartOf(now, 'day', tz);
    const isFixed = unitType === 'fixed';

    const timeUnit = startTimeInterval
      ? bookingTimeUnits[startTimeInterval]?.timeUnit
      : unitType === 'hour'
      ? 'hour'
      : 'day';
    const nextBoundary = findNextBoundary(now, 1, timeUnit, tz);

    const nextMonth = getStartOf(nextBoundary, 'month', tz, 1, 'months');
    const nextAfterNextMonth = getStartOf(nextMonth, 'month', tz, 1, 'months');

    const variants = priceVariants || [];
    const bookingLengthInMinutes = variants.reduce((min, priceVariant) => {
      return Math.min(min, priceVariant.bookingLengthInMinutes);
    }, Number.MAX_SAFE_INTEGER);

    const nextMonthEnd = isFixed
      ? getStartOf(nextMonth, 'minute', tz, bookingLengthInMinutes, 'minutes')
      : nextMonth;
    const followingMonthEnd = isFixed
      ? getStartOf(nextAfterNextMonth, 'minute', tz, bookingLengthInMinutes, 'minutes')
      : nextAfterNextMonth;

    const minDurationStartingInInterval = isFixed ? bookingLengthInMinutes : 60;

    const options = intervalAlign => {
      return ['fixed', 'hour'].includes(unitType)
        ? {
            extraQueryParams: {
              intervalDuration: 'P1D',
              intervalAlign,
              maxPerInterval: 1,
              minDurationStartingInInterval,
              perPage: 31,
              page: 1,
            },
          }
        : null;
    };

    return Promise.all([
      dispatch(fetchTimeSlots(listing.id, nextBoundary, nextMonthEnd, tz, options(startOfToday))),
      dispatch(fetchTimeSlots(listing.id, nextMonth, followingMonthEnd, tz, options(nextMonth))),
    ]);
  }

  // By default return an empty array
  return Promise.all([]);
};

//////////////////////////////////
// Fetch Transaction Line Items //
//////////////////////////////////
const fetchTransactionLineItemsPayloadCreator = (
  { orderData, listingId, isOwnListing },
  { rejectWithValue }
) => {
  return transactionLineItems({ orderData, listingId, isOwnListing })
    .then(response => {
      return response.data;
    })
    .catch(e => {
      log.error(e, 'fetching-line-items-failed', {
        listingId: listingId.uuid,
        orderData,
        statusText: e.statusText,
      });
      return rejectWithValue(storableError(e));
    });
};

export const fetchTransactionLineItemsThunk = createAsyncThunk(
  'ListingPage/fetchTransactionLineItems',
  fetchTransactionLineItemsPayloadCreator
);
// Backward compatible wrapper for the thunk
export const fetchTransactionLineItems = ({ orderData, listingId, isOwnListing }) => dispatch => {
  // Errors are stored in Redux via rejectWithValue (and logged in the payload creator).
  // Do not unwrap: OrderPanel callers are fire-and-forget and would otherwise create
  // unhandled rejections of plain storableError objects in Sentry.
  return dispatch(fetchTransactionLineItemsThunk({ orderData, listingId, isOwnListing }));
};

/////////////////////////////
// Fetch Similar Listings  //
/////////////////////////////

// JDM: the design shows two rows of four similar listings
export const SIMILAR_LISTINGS_COUNT = 8;

/**
 * Query params of the similar listings: the same category, make and model (cars) or part make
 * (parts) as the listing. One extra listing is fetched, as the listing itself can be among the
 * results (the API can't exclude it). The fields are the ones the JDM listing card shows.
 *
 * @param {Object} listing the listing on the page
 * @param {Object} config marketplace config
 * @returns {Object|null} null when the listing has no JDM category
 */
export const similarListingsQueryParams = (listing, config) => {
  const publicData = listing?.attributes?.publicData || {};
  const seoPage = jdmSeoPageForListing(publicData, config.listing?.listingFields);
  if (!seoPage) {
    return null;
  }
  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = config.layout.listingImage;
  const aspectRatio = aspectHeight / aspectWidth;

  return {
    ...seoPage.filters,
    page: 1,
    perPage: SIMILAR_LISTINGS_COUNT + 1,
    minStock: 1,
    stockMode: 'match-undefined',
    include: ['author', 'images'],
    'fields.listing': [
      'title',
      'price',
      'deleted',
      'state',
      'publicData.listingType',
      'publicData.transactionProcessAlias',
      'publicData.unitType',
      'publicData.cardStyle',
      // JDM listing card: year, make, model, state, odometer / condition
      ...JDM_CARD_PUBLIC_DATA_FIELDS,
    ],
    'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
    'fields.image': [
      'variants.scaled-small',
      'variants.scaled-medium',
      `variants.${variantPrefix}`,
      `variants.${variantPrefix}-2x`,
    ],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    'limit.images': 1,
  };
};

const fetchSimilarListingsPayloadCreator = (
  { listing, config },
  { dispatch, rejectWithValue, extra: sdk }
) => {
  const params = similarListingsQueryParams(listing, config);
  if (!params) {
    return Promise.resolve([]);
  }
  return sdk.listings
    .query(params)
    .then(response => {
      // The listing itself comes back with the card's sparse fields and one image. It must not
      // reach the store, where it would replace the full listing shown on the page.
      const others = response.data.data
        .filter(l => l.id.uuid !== listing.id.uuid)
        .slice(0, SIMILAR_LISTINGS_COUNT);
      const withoutListing = { ...response, data: { ...response.data, data: others } };
      const sanitizeConfig = { listingFields: config?.listing?.listingFields };
      dispatch(addMarketplaceEntities(withoutListing, sanitizeConfig));
      return others.map(l => l.id);
    })
    .catch(e => {
      log.error(e, 'fetch-similar-listings-failed', { listingId: listing?.id?.uuid });
      return rejectWithValue(storableError(e));
    });
};

/**
 * Similar listings are fetched by the page when their section scrolls into view, not in loadData,
 * so they cost nothing for visitors who never scroll that far.
 */
export const fetchSimilarListingsThunk = createAsyncThunk(
  'ListingPage/fetchSimilarListings',
  fetchSimilarListingsPayloadCreator
);
// Backward compatible wrapper for the thunk
export const fetchSimilarListings = (listing, config) => dispatch => {
  return dispatch(fetchSimilarListingsThunk({ listing, config }));
};

// ================ Slice ================ //

const initialState = {
  id: null,
  showListingError: null,
  reviews: [],
  fetchReviewsError: null,
  monthlyTimeSlots: {
    // '2022-03': {
    //   timeSlots: [],
    //   fetchTimeSlotsError: null,
    //   fetchTimeSlotsInProgress: null,
    // },
  },
  timeSlotsForDate: {
    // For small time units, we fetch monthly time slots with sparse mode for calendar view
    // and when the user clicks on a day, we make a full time slot query. This is for that purpose.
    // '2025-02-03': {
    //   timeSlots: [],
    //   fetchedAt: 1738569600000,
    //   fetchTimeSlotsError: null,
    //   fetchTimeSlotsInProgress: null,
    // },
  },
  lineItems: null,
  fetchLineItemsInProgress: false,
  fetchLineItemsError: null,
  sendInquiryInProgress: false,
  sendInquiryError: null,
  inquiryModalOpenForListingId: null,
  // JDM: similar listings of the listing with id similarListingsForId (uuid)
  similarListingsForId: null,
  similarListingIds: [],
  similarListingsInProgress: false,
  similarListingsError: null,
};

const listingPageSlice = createSlice({
  name: 'ListingPage',
  initialState,
  reducers: {
    setInitialValues: (state, action) => {
      return { ...initialState, ...action.payload };
    },
  },
  extraReducers: builder => {
    builder
      .addCase(showListingThunk.pending, (state, action) => {
        state.id = action.meta.arg.listingId;
        state.showListingError = null;
      })
      .addCase(showListingThunk.fulfilled, (state, action) => {
        // Data is handled by addMarketplaceEntities in the thunk
        state.id = action.payload.data.data.id;
      })
      .addCase(showListingThunk.rejected, (state, action) => {
        state.showListingError = action.payload;
      })
      .addCase(fetchReviewsThunk.pending, state => {
        state.fetchReviewsError = null;
      })
      .addCase(fetchReviewsThunk.fulfilled, (state, action) => {
        state.reviews = action.payload;
      })
      .addCase(fetchReviewsThunk.rejected, (state, action) => {
        state.fetchReviewsError = action.payload;
      })
      .addCase(fetchTimeSlotsThunk.pending, (state, action) => {
        const { options, start, timeZone } = action.meta.arg;
        const { useFetchTimeSlotsForDate = false } = options || {};

        if (useFetchTimeSlotsForDate) {
          const dateId = stringifyDateToISO8601(start, timeZone);
          state.timeSlotsForDate = removeOutdatedDateData(state.timeSlotsForDate);
          if (!state.timeSlotsForDate[dateId]) {
            state.timeSlotsForDate[dateId] = {};
          }
          state.timeSlotsForDate[dateId].fetchTimeSlotsError = null;
          state.timeSlotsForDate[dateId].fetchedAt = null;
          state.timeSlotsForDate[dateId].fetchTimeSlotsInProgress = true;
          state.timeSlotsForDate[dateId].timeSlots = [];
        } else {
          const monthId = monthIdString(start, timeZone);
          if (!state.monthlyTimeSlots[monthId]) {
            state.monthlyTimeSlots[monthId] = {};
          }
          state.monthlyTimeSlots[monthId].fetchTimeSlotsError = null;
          state.monthlyTimeSlots[monthId].fetchTimeSlotsInProgress = true;
        }
      })
      .addCase(fetchTimeSlotsThunk.fulfilled, (state, action) => {
        const { options, start, timeZone } = action.meta.arg;
        const { useFetchTimeSlotsForDate = false } = options || {};

        if (useFetchTimeSlotsForDate) {
          const dateId = stringifyDateToISO8601(start, timeZone);
          if (!state.timeSlotsForDate[dateId]) {
            state.timeSlotsForDate[dateId] = {};
          }
          state.timeSlotsForDate[dateId].fetchTimeSlotsInProgress = false;
          state.timeSlotsForDate[dateId].fetchedAt = new Date().getTime();
          state.timeSlotsForDate[dateId].timeSlots = action.payload;
        } else {
          const monthId = monthIdString(start, timeZone);
          if (!state.monthlyTimeSlots[monthId]) {
            state.monthlyTimeSlots[monthId] = {};
          }
          state.monthlyTimeSlots[monthId].fetchTimeSlotsInProgress = false;
          state.monthlyTimeSlots[monthId].timeSlots = action.payload;
        }
      })
      .addCase(fetchTimeSlotsThunk.rejected, (state, action) => {
        const { options, start, timeZone } = action.meta.arg;
        const { useFetchTimeSlotsForDate = false } = options || {};

        if (useFetchTimeSlotsForDate) {
          const dateId = stringifyDateToISO8601(start, timeZone);
          if (!state.timeSlotsForDate[dateId]) {
            state.timeSlotsForDate[dateId] = {};
          }
          state.timeSlotsForDate[dateId].fetchTimeSlotsInProgress = false;
          state.timeSlotsForDate[dateId].fetchTimeSlotsError = action.payload;
        } else {
          const monthId = monthIdString(start, timeZone);
          if (!state.monthlyTimeSlots[monthId]) {
            state.monthlyTimeSlots[monthId] = {};
          }
          state.monthlyTimeSlots[monthId].fetchTimeSlotsInProgress = false;
          state.monthlyTimeSlots[monthId].fetchTimeSlotsError = action.payload;
        }
      })
      .addCase(sendInquiryThunk.pending, state => {
        state.sendInquiryInProgress = true;
        state.sendInquiryError = null;
      })
      .addCase(sendInquiryThunk.fulfilled, state => {
        state.sendInquiryInProgress = false;
        state.inquiryModalOpenForListingId = null;
      })
      .addCase(sendInquiryThunk.rejected, (state, action) => {
        state.sendInquiryInProgress = false;
        state.sendInquiryError = action.payload;
      })
      .addCase(fetchTransactionLineItemsThunk.pending, state => {
        state.fetchLineItemsInProgress = true;
        state.fetchLineItemsError = null;
      })
      .addCase(fetchTransactionLineItemsThunk.fulfilled, (state, action) => {
        state.fetchLineItemsInProgress = false;
        state.lineItems = action.payload;
      })
      .addCase(fetchTransactionLineItemsThunk.rejected, (state, action) => {
        state.fetchLineItemsInProgress = false;
        state.fetchLineItemsError = action.payload;
      })
      .addCase(fetchSimilarListingsThunk.pending, (state, action) => {
        state.similarListingsForId = action.meta.arg.listing?.id?.uuid || null;
        state.similarListingIds = [];
        state.similarListingsInProgress = true;
        state.similarListingsError = null;
      })
      .addCase(fetchSimilarListingsThunk.fulfilled, (state, action) => {
        // Ignore a response for a listing the visitor already left
        if (state.similarListingsForId === action.meta.arg.listing?.id?.uuid) {
          state.similarListingIds = action.payload;
          state.similarListingsInProgress = false;
        }
      })
      .addCase(fetchSimilarListingsThunk.rejected, (state, action) => {
        if (state.similarListingsForId === action.meta.arg.listing?.id?.uuid) {
          state.similarListingsInProgress = false;
          state.similarListingsError = action.payload;
        }
      });
  },
});

export const { setInitialValues } = listingPageSlice.actions;

export default listingPageSlice.reducer;

// ================ Load data ================ //

export const loadData = (params, search, config) => (dispatch, getState, sdk) => {
  const listingId = new UUID(params.id);
  const state = getState();
  const currentUser = state.user?.currentUser;
  const inquiryModalOpenForListingId =
    isUserAuthorized(currentUser) && hasPermissionToInitiateTransactions(currentUser)
      ? state.ListingPage.inquiryModalOpenForListingId
      : null;

  // Clear old line-items
  dispatch(setInitialValues({ lineItems: null, inquiryModalOpenForListingId }));

  const ownListingVariants = [LISTING_PAGE_DRAFT_VARIANT, LISTING_PAGE_PENDING_APPROVAL_VARIANT];
  if (ownListingVariants.includes(params.variant)) {
    return dispatch(showListing(listingId, config, true));
  }

  // In private marketplace mode, this page won't fetch data if the user is unauthorized
  const isAuthorized = currentUser && isUserAuthorized(currentUser);
  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const canFetchData = !isPrivateMarketplace || (isPrivateMarketplace && isAuthorized);
  if (!canFetchData) {
    return Promise.resolve();
  }

  const hasNoViewingRights = currentUser && !hasPermissionToViewData(currentUser);
  const promises = hasNoViewingRights
    ? // If user has no viewing rights, only allow fetching their own listing without reviews
      [dispatch(showListing(listingId, config, true))]
    : // For users with viewing rights, fetch the listing and the associated reviews
      [dispatch(showListing(listingId, config)), dispatch(fetchReviews(listingId))];

  return Promise.all(promises).then(response => {
    const listingResponse = response[0];
    const listing = listingResponse?.data?.data;
    const transactionProcessAlias = listing?.attributes?.publicData?.transactionProcessAlias || '';
    if (isBookingProcessAlias(transactionProcessAlias) && !hasNoViewingRights) {
      // Fetch timeSlots if the user has viewing rights.
      // This can happen parallel to loadData.
      // We are not interested to return them from loadData call.
      fetchMonthlyTimeSlots(dispatch, listing);
    }
    return response;
  });
};
