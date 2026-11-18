import React from 'react';
import '@testing-library/jest-dom';

import configureStore from '../../store';
import { types as sdkTypes } from '../../util/sdkLoader';
import {
  createUser,
  createCurrentUser,
  createListing,
  createOwnListing,
  createReview,
} from '../../util/testData';
import {
  renderWithProviders as render,
  testingLibrary,
  getRouteConfiguration,
  getHostedConfiguration,
} from '../../util/testHelpers';

import { storableError } from '../../util/errors';

import {
  LISTING_STATE_PENDING_APPROVAL,
  LISTING_STATE_PUBLISHED,
  LISTING_STATE_CLOSED,
} from '../../util/types';

import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

import reducer, {
  showListing,
  loadData,
  setInitialValues,
  getShowListingImageParams,
  fetchSimilarListings,
  fetchSimilarListingsThunk,
  similarListingsQueryParams,
} from './ListingPage.duck';

import ActionBar from './Notifications/ActionBar';

const { UUID } = sdkTypes;
const { screen, waitFor, within } = testingLibrary;
const noop = () => null;

const logger = actions => () => {
  return next => action => {
    actions.push(action);
    // Call the next dispatch method in the middleware chain.
    return next(action);
  };
};

const listingTypes = [
  {
    id: 'sell-bicycles',
    transactionProcess: {
      name: 'default-purchase',
      alias: 'default-purchase/release-1',
    },
    unitType: 'item',
  },
  {
    id: 'rent-bicycles-nightly',
    transactionProcess: {
      name: 'default-booking',
      alias: 'default-booking/release-1',
    },
    unitType: 'night',
  },
];

const capitalizeFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);
const addSpaces = str => str.split('-').join(' ');
const labelize = str => addSpaces(capitalizeFirstLetter(str));

const generateCategories = optionStrings => {
  return optionStrings.reduce((converted, entry) => {
    const isArray = Array.isArray(entry);
    const option = isArray
      ? { id: entry[0], name: labelize(entry[0]), subcategories: generateCategories(entry[1]) }
      : { id: entry, name: labelize(entry) };
    return [...converted, option];
  }, []);
};
const categories = generateCategories([
  ['dogs', ['labradors', 'poodles']],
  ['cats', ['burmese', 'egyptian-mau']],
  ['fish', [['freshwater', ['grayling', 'arctic-char', 'pike']], 'saltwater']],
  ['birds', ['parrot', 'macaw']],
]);
//console.log(JSON.stringify(categories, null, 2));

const listingFields = [
  {
    key: 'cat',
    scope: 'public',
    listingTypeConfig: {
      limitToListingTypeIds: true,
      listingTypeIds: ['sell-bicycles'],
    },
    categoryConfig: {
      limitToCategoryIds: true,
      categoryIds: ['cats'],
    },
    schemaType: 'enum',
    enumOptions: [{ option: 'cat_1', label: 'Cat 1' }, { option: 'cat_2', label: 'Cat 2' }],
    filterConfig: {
      showFilter: true,
    },
    showConfig: {
      label: 'Cat',
      isDetail: true,
    },
  },
  {
    key: 'amenities',
    scope: 'public',
    listingTypeConfig: {
      limitToListingTypeIds: true,
      listingTypeIds: ['rent-bicycles-daily', 'rent-bicycles-nightly', 'rent-bicycles-hourly'],
    },
    schemaType: 'multi-enum',
    enumOptions: [
      { option: 'feat_1', label: 'Feat 1' },
      { option: 'feat_2', label: 'Feat 2' },
      { option: 'feat_3', label: 'Feat 3' },
    ],
    filterConfig: {
      showFilter: true,
    },
    showConfig: {
      label: 'Amenities',
      searchMode: 'has_all',
      group: 'secondary',
    },
  },
];

const getConfig = variantType => {
  const hostedConfig = getHostedConfiguration();
  return {
    ...hostedConfig,
    listingTypes: {
      listingTypes,
    },
    listingFields: {
      listingFields,
    },
    categories: { categories },
    layout: {
      ...hostedConfig.layout,
      listingPage: { variantType },
    },
  };
};

const id = 'listing1';
const slug = 'listing1-title';
const publicData = {
  listingType: 'sell-bicycles', // Ensure listing field can be tied to listing type
  transactionProcessAlias: 'default-purchase/release-1',
  unitType: 'item',
  categoryLevel1: 'cats', // Ensure listing field can be tied to category
  cat: 'cat_1',
};
const listing1 = createListing(id, { publicData }, { author: createUser('user-1') });
const listing1Own = createOwnListing(id, {}, { author: createCurrentUser('user-1') });
const review = createReview(
  'review-id',
  {
    createdAt: new Date(Date.UTC(2023, 5, 19, 11, 34)),
    rating: 4,
    type: 'ofProvider',
    content: 'It was awesome!',
  },
  { author: createUser('reviewerA'), listing: listing1 }
);

// We'll initialize the store with relevant listing data
const initialState = {
  ListingPage: {
    id: listing1.id,
    showListingError: null,
    reviews: [review],
    fetchReviewsError: null,
    monthlyTimeSlots: {
      // '2022-03': {
      //   timeSlots: [],
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
  },
  marketplaceData: {
    entities: {
      listing: {
        listing1,
      },
      ownListing: {
        listing1: listing1Own,
      },
    },
  },
};

describe('ListingPage variants', () => {
  const commonProps = {
    params: { id, slug },
    scrollingDisabled: false,
    onManageDisableScrolling: noop,
    callSetInitialValues: noop,
    setInitialValues: noop,
    onFetchTransactionLineItems: noop,
    onSendInquiry: noop,
    onInitializeCardPaymentData: noop,
    onFetchTimeSlots: noop,
  };

  it('has hero section in coverPhoto mode', async () => {
    // Select correct SearchPage variant according to route configuration
    const config = getConfig('coverPhoto');
    const routeConfiguration = getRouteConfiguration(config.layout);
    const props = { ...commonProps };
    const listingRouteConfig = routeConfiguration.find(conf => conf.name === 'ListingPage');
    const ListingPage = listingRouteConfig.component;

    const { queryByPlaceholderText, getByRole, queryAllByRole, getByText } = render(
      <ListingPage {...props} />,
      {
        initialState,
        config,
        routeConfiguration,
      }
    );

    await waitFor(() => {
      // JDM: no search bar in the Topbar
      expect(queryByPlaceholderText('TopbarSearchForm.placeholder')).not.toBeInTheDocument();

      // Has hero (coverPhoto) section
      expect(screen.getByTestId('hero')).toBeInTheDocument();
      expect(screen.queryByTestId('carousel')).not.toBeInTheDocument();

      // Has order title (rendered for )
      const orderTitle = queryAllByRole('heading', { name: 'ListingPage.orderTitle' });
      expect(orderTitle).toHaveLength(3);

      // Has details section title and selected category info
      expect(getByRole('heading', { name: 'ListingPage.detailsTitle' })).toBeInTheDocument();
      expect(getByText('Cat')).toBeInTheDocument();
      expect(getByText('Cat 1')).toBeInTheDocument();

      // Has details location title
      expect(getByRole('heading', { name: 'ListingPage.locationTitle' })).toBeInTheDocument();

      // Has details reviews title
      const reviewsTitle = getByRole('heading', { name: 'ListingPage.reviewsTitle' });
      expect(reviewsTitle).toBeInTheDocument();
      const sectionReviews = within(reviewsTitle.parentNode.parentNode);
      expect(sectionReviews.getByText('It was awesome!')).toBeInTheDocument();
      expect(sectionReviews.getByText('reviewerA display name')).toBeInTheDocument();
      expect(sectionReviews.getByText('June 2023')).toBeInTheDocument();
      expect(sectionReviews.getAllByTitle('4/5')).toHaveLength(2);

      // Has details provider/author title
      expect(getByRole('heading', { name: 'ListingPage.aboutProviderTitle' })).toBeInTheDocument();
      // Has link to provider's profile
      expect(getByRole('link', { name: 'UserCard.viewProfileLink' })).toBeInTheDocument();
      // Has button to contact provider
      expect(getByRole('button', { name: 'UserCard.contactUser' })).toBeInTheDocument();
    });
  });

  it('has carousel on carousel mode', async () => {
    // Select correct SearchPage variant according to route configuration
    const config = getConfig('carousel');
    const routeConfiguration = getRouteConfiguration(config.layout);
    const props = { ...commonProps };
    const listingRouteConfig = routeConfiguration.find(conf => conf.name === 'ListingPage');
    const ListingPage = listingRouteConfig.component;

    const { queryByPlaceholderText, getByRole, queryAllByRole, getByText } = render(
      <ListingPage {...props} />,
      {
        initialState,
        config,
        routeConfiguration,
      }
    );
    await waitFor(() => {
      // JDM: no search bar in the Topbar
      expect(queryByPlaceholderText('TopbarSearchForm.placeholder')).not.toBeInTheDocument();

      // Does not have hero (coverPhoto) section on carousel mode
      expect(screen.getByTestId('carousel')).toBeInTheDocument();
      expect(screen.queryByTestId('hero')).not.toBeInTheDocument();

      // Has order title (rendered for )
      const orderTitle = queryAllByRole('heading', { name: 'ListingPage.orderTitle' });
      expect(orderTitle).toHaveLength(3);

      // Has details section title and selected category info
      expect(getByRole('heading', { name: 'ListingPage.detailsTitle' })).toBeInTheDocument();
      expect(getByText('Cat')).toBeInTheDocument();
      expect(getByText('Cat 1')).toBeInTheDocument();

      // Has details location title
      expect(getByRole('heading', { name: 'ListingPage.locationTitle' })).toBeInTheDocument();

      // Has details reviews title
      const reviewsTitle = getByRole('heading', { name: 'ListingPage.reviewsTitle' });
      expect(reviewsTitle).toBeInTheDocument();
      const sectionReviews = within(reviewsTitle.parentNode.parentNode);
      expect(sectionReviews.getByText('It was awesome!')).toBeInTheDocument();
      expect(sectionReviews.getByText('reviewerA display name')).toBeInTheDocument();
      expect(sectionReviews.getByText('June 2023')).toBeInTheDocument();
      expect(sectionReviews.getAllByTitle('4/5')).toHaveLength(2);

      // Has details provider/author title
      expect(getByRole('heading', { name: 'ListingPage.aboutProviderTitle' })).toBeInTheDocument();
      // Has link to provider's profile
      expect(getByRole('link', { name: 'UserCard.viewProfileLink' })).toBeInTheDocument();
      // Has button to contact provider
      expect(getByRole('button', { name: 'UserCard.contactUser' })).toBeInTheDocument();
    });
  });
});

// JDM car listing (inquiry listing type) for the Miro listing page
const jdmListingTypes = [
  ...listingTypes,
  {
    id: 'standard-jdm-cars-listings',
    transactionProcess: { name: 'default-inquiry', alias: 'default-inquiry/release-1' },
    unitType: 'inquiry',
    defaultListingFields: { images: true, description: true, price: true },
  },
];
const jdmCarsOnly = { limitToCategoryIds: true, categoryIds: ['jdm-cars'] };
const jdmListingFields = [
  {
    key: 'make',
    scope: 'public',
    schemaType: 'enum',
    categoryConfig: jdmCarsOnly,
    enumOptions: [{ option: 'nissan', label: 'Nissan' }],
  },
  {
    key: 'model',
    scope: 'public',
    schemaType: 'enum',
    categoryConfig: jdmCarsOnly,
    enumOptions: [{ option: 'nissan-silvia', label: 'Silvia' }],
  },
  {
    key: 'state',
    scope: 'public',
    schemaType: 'enum',
    categoryConfig: jdmCarsOnly,
    enumOptions: [{ option: 'vic', label: 'Victoria' }],
  },
  { key: 'year', scope: 'public', schemaType: 'long', categoryConfig: jdmCarsOnly },
  { key: 'odometer', scope: 'public', schemaType: 'long', categoryConfig: jdmCarsOnly },
];
const jdmCategories = [{ id: 'jdm-cars', name: 'JDM Cars' }];
const getJdmConfig = () => {
  const config = getConfig('carousel');
  return {
    ...config,
    listingTypes: { listingTypes: jdmListingTypes },
    listingFields: { listingFields: jdmListingFields },
    categories: { categories: jdmCategories },
  };
};
const jdmId = 'jdm-listing-1';
const jdmListing = createListing(
  jdmId,
  {
    title: 'Clean S15 Spec R',
    description: 'One owner.\nNever tracked.',
    publicData: {
      listingType: 'standard-jdm-cars-listings',
      transactionProcessAlias: 'default-inquiry/release-1',
      unitType: 'inquiry',
      categoryLevel1: 'jdm-cars',
      make: 'nissan',
      model: 'nissan-silvia',
      state: 'vic',
      year: 2001,
      odometer: 120000,
    },
  },
  { author: createUser('user-1'), images: [] }
);
const jdmInitialState = {
  ...initialState,
  ListingPage: { ...initialState.ListingPage, id: jdmListing.id, reviews: [] },
  marketplaceData: { entities: { listing: { [jdmId]: jdmListing } } },
};

describe('ListingPage JDM layout', () => {
  it('renders breadcrumbs, the title, specs, the price box and similar listings', async () => {
    const config = getJdmConfig();
    const routeConfiguration = getRouteConfiguration(config.layout);
    const ListingPage = routeConfiguration.find(conf => conf.name === 'ListingPage').component;
    const props = {
      params: { id: jdmId, slug: 'clean-s15-spec-r' },
      scrollingDisabled: false,
      onManageDisableScrolling: noop,
      callSetInitialValues: noop,
      setInitialValues: noop,
    };

    const { getByRole, getAllByRole, getByText, queryByTestId } = render(
      <ListingPage {...props} />,
      { initialState: jdmInitialState, config, routeConfiguration }
    );

    await waitFor(() => {
      // Title is the h1 (client: "<h1>"), sections are h2
      expect(getByRole('heading', { level: 1, name: 'Clean S15 Spec R' })).toBeInTheDocument();
      expect(
        getByRole('heading', { level: 2, name: 'ListingPage.jdm.specsTitle' })
      ).toBeInTheDocument();
      expect(
        getByRole('heading', { level: 2, name: 'ListingPage.jdm.descriptionTitle' })
      ).toBeInTheDocument();
      expect(
        getByRole('heading', { level: 2, name: 'ListingPage.jdm.similarTitle' })
      ).toBeInTheDocument();
      // Not the template carousel layout
      expect(queryByTestId('carousel')).not.toBeInTheDocument();
    });

    // Breadcrumbs: Home > JDM Cars > Nissan > Silvia > title
    const crumbs = within(getByRole('navigation', { name: 'JdmSeo.breadcrumbAriaLabel' }));
    expect(crumbs.getByRole('link', { name: 'JdmSeo.breadcrumbCars' })).toHaveAttribute(
      'href',
      '/jdm-cars/'
    );
    expect(crumbs.getByRole('link', { name: 'Silvia' })).toHaveAttribute(
      'href',
      '/jdm-cars/nissan/silvia/'
    );

    // Specs are list items (client: "<li>"), Make and Model link to their search pages
    const specs = within(
      getByRole('heading', { name: 'ListingPage.jdm.specsTitle' }).parentNode
    ).getAllByRole('listitem');
    expect(specs.map(li => li.textContent)).toEqual([
      'ListingPage.jdm.specMakeNissan',
      'ListingPage.jdm.specModelSilvia',
      'ListingPage.jdm.specYear2001',
      'ListingPage.jdm.specLocationVictoria',
      'ListingPage.jdm.specOdometerListingCard.odometer',
    ]);
    const specLinks = getAllByRole('link', { name: 'Nissan' });
    expect(specLinks.some(a => a.getAttribute('href') === '/jdm-cars/nissan/')).toBe(true);

    // No photos: a placeholder instead of an empty gallery
    expect(getByText('ListingPage.jdm.noPhotos')).toBeInTheDocument();
    // Price box
    expect(getByRole('button', { name: /ListingPage.jdm.messageSeller/ })).toBeInTheDocument();
    expect(getByText('ListingPage.jdm.seller')).toBeInTheDocument();
  });
});

describe('Duck', () => {
  const listingFields = [];
  const config = {
    layout: {
      listingImage: {
        aspectWidth: 400,
        aspectHeight: 400,
        variantPrefix: 'listing-card',
      },
    },
    listing: {
      listingFields,
    },
    accessControl: { marketplace: { private: true } },
  };

  describe('reducer', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        id: null,
        showListingError: null,
        reviews: [],
        fetchReviewsError: null,
        monthlyTimeSlots: {},
        timeSlotsForDate: {},
        lineItems: null,
        fetchLineItemsInProgress: false,
        fetchLineItemsError: null,
        sendInquiryInProgress: false,
        sendInquiryError: null,
        inquiryModalOpenForListingId: null,
        similarListingsForId: null,
        similarListingIds: [],
        similarListingsInProgress: false,
        similarListingsError: null,
      });
    });

    it('should handle setInitialValues action', () => {
      // First set up a state with some data
      let state = reducer(undefined, { type: '@@INIT' });
      state = reducer(state, {
        type: 'ListingPage/showListing/rejected',
        payload: new Error('Test error'),
      });
      state = reducer(state, {
        type: 'ListingPage/fetchReviews/rejected',
        payload: new Error('Reviews error'),
      });
      state = reducer(state, {
        type: 'ListingPage/fetchTimeSlots/rejected',
        payload: new Error('TimeSlots error'),
        meta: {
          arg: {
            useFetchTimeSlotsForDate: false,
            start: new Date('2023-01-01'),
            timeZone: 'UTC',
          },
        },
      });
      state = reducer(state, {
        type: 'ListingPage/fetchTransactionLineItems/fulfilled',
        payload: { test: 'lineItems' },
      });

      // Now test setInitialValues - it should reset to initial state and apply payload
      state = reducer(
        state,
        setInitialValues({
          inquiryModalOpenForListingId: 'test-id',
        })
      );

      // Should reset all errors and clear lineItems
      expect(state.showListingError).toBeNull();
      expect(state.fetchReviewsError).toBeNull();
      expect(state.fetchLineItemsError).toBeNull();
      expect(state.sendInquiryError).toBeNull();
      expect(state.lineItems).toBeNull();
      expect(state.monthlyTimeSlots).toEqual({});
      expect(state.timeSlotsForDate).toEqual({});

      // Should apply the payload
      expect(state.inquiryModalOpenForListingId).toBe('test-id');
    });

    it('should handle showListingThunk.pending', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const state = reducer(initialState, {
        type: 'ListingPage/showListing/pending',
        meta: { arg: { listingId: 'test-listing-id' } },
      });

      expect(state.id).toBe('test-listing-id');
      expect(state.showListingError).toBeNull();
    });

    it('should handle showListingThunk.rejected', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const error = new Error('Test error');
      const state = reducer(initialState, {
        type: 'ListingPage/showListing/rejected',
        payload: error,
      });

      expect(state.showListingError).toBe(error);
    });

    it('should handle fetchReviewsThunk.pending', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const state = reducer(initialState, {
        type: 'ListingPage/fetchReviews/pending',
      });

      expect(state.fetchReviewsError).toBeNull();
    });

    it('should handle fetchReviewsThunk.fulfilled', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const reviews = [{ id: 'review1' }, { id: 'review2' }];
      const state = reducer(initialState, {
        type: 'ListingPage/fetchReviews/fulfilled',
        payload: reviews,
      });

      expect(state.reviews).toEqual(reviews);
    });

    it('should handle fetchReviewsThunk.rejected', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const error = new Error('Reviews error');
      const state = reducer(initialState, {
        type: 'ListingPage/fetchReviews/rejected',
        payload: error,
      });

      expect(state.fetchReviewsError).toBe(error);
    });
  });

  describe('getShowListingImageParams', () => {
    const listingImageConfig = { variantPrefix: 'listing-card', aspectRatio: 1 };

    it('returns a lean SSR set: two images, LCP/social/schema + base thumb crop', () => {
      const params = getShowListingImageParams(listingImageConfig, false);

      expect(params['limit.images']).toBe(2);
      expect(params['fields.image']).toEqual([
        'variants.scaled-small',
        'variants.scaled-medium',
        'variants.scaled-large',
        'variants.scaled-xlarge',
        'variants.listing-card',
        'variants.listing-card-2x',
        'variants.facebook',
        'variants.twitter',
        'variants.square-small',
        'variants.square-small2x',
      ]);
      expect(params['imageVariant.listing-card']).toBe('w:400;h:400;fit:crop');
      expect(params['imageVariant.listing-card-2x']).toBe('w:800;h:800;fit:crop');
      expect(params).not.toHaveProperty('imageVariant.listing-card-4x');
      expect(params).not.toHaveProperty('imageVariant.listing-card-6x');
      expect(params['fields.image']).not.toContain('variants.listing-card-4x');
      expect(params['fields.image']).not.toContain('variants.listing-card-6x');
    });

    it('returns the full browser set with all gallery crops', () => {
      const params = getShowListingImageParams(listingImageConfig, true);

      expect(params).not.toHaveProperty('limit.images');
      expect(params['fields.image']).toEqual([
        'variants.scaled-small',
        'variants.scaled-medium',
        'variants.scaled-large',
        'variants.scaled-xlarge',
        'variants.listing-card',
        'variants.listing-card-2x',
        'variants.listing-card-4x',
        'variants.listing-card-6x',
        'variants.facebook',
        'variants.twitter',
        'variants.square-small',
        'variants.square-small2x',
      ]);
      expect(params['imageVariant.listing-card']).toBe('w:400;h:400;fit:crop');
      expect(params['imageVariant.listing-card-2x']).toBe('w:800;h:800;fit:crop');
      expect(params['imageVariant.listing-card-4x']).toBe('w:1600;h:1600;fit:crop');
      expect(params['imageVariant.listing-card-6x']).toBe('w:2400;h:2400;fit:crop');
    });
  });

  describe('showListing thunk', () => {
    it('should dispatch success and fetch current user', () => {
      const id = new UUID('00000000-0000-0000-0000-000000000000');
      const response = { data: { data: listing1, include: [] } };
      const sdk = {
        listings: { show: jest.fn(() => Promise.resolve(response)) },
        currentUser: { show: jest.fn(() => Promise.resolve({})) },
        authInfo: jest.fn(() => Promise.resolve({})),
      };
      let actions = [];
      const store = configureStore({
        initialState: { ListingPage: reducer(undefined, { type: '@@INIT' }) },
        sdk,
        extraMiddlewares: [logger(actions)],
      });
      const dispatch = store.dispatch;
      const getState = store.getState;

      return showListing(id, config)(dispatch, getState, sdk).then(data => {
        // Jest runs in jsdom (browser), so showListing uses the full image set.
        expect(sdk.listings.show.mock.calls).toEqual([
          [
            expect.objectContaining({
              id,
              'imageVariant.listing-card': 'w:400;h:400;fit:crop',
              'imageVariant.listing-card-2x': 'w:800;h:800;fit:crop',
              'imageVariant.listing-card-4x': 'w:1600;h:1600;fit:crop',
              'imageVariant.listing-card-6x': 'w:2400;h:2400;fit:crop',
              include: ['author', 'author.profileImage', 'images', 'currentStock'],
            }),
          ],
        ]);
        expect(sdk.listings.show.mock.calls[0][0]).not.toHaveProperty('limit.images');

        const relevantActions = actions.filter(
          action => !action.type.startsWith('user/fetchCurrentUser/')
        );

        // Check that the expected action types are present
        expect(relevantActions[0].type).toBe('ListingPage/showListing/pending');
        expect(relevantActions[0].meta.arg).toEqual({ listingId: id, config, isOwn: false });

        expect(relevantActions[1].type).toBe('marketplaceData/addEntities');
        expect(relevantActions[2].type).toBe('ListingPage/showListing/fulfilled');
        expect(relevantActions[2].payload).toEqual(response);

        // fetchCurrentUser may complete after the main thunk resolves
        const fetchCurrentUserFulfilled = actions.find(
          action => action.type === 'user/fetchCurrentUser/fulfilled'
        );
        expect(fetchCurrentUserFulfilled).toBeDefined();
      });
    });

    it('should dispatch error', () => {
      const id = new UUID('00000000-0000-0000-0000-000000000000');
      const error = new Error('fail');
      const sdk = {
        listings: { show: jest.fn(() => Promise.reject(error)) },
        currentUser: { show: jest.fn(() => Promise.resolve({})) },
        authInfo: jest.fn(() => Promise.resolve({})),
      };
      let actions = [];
      const store = configureStore({
        initialState: { ListingPage: reducer(undefined, { type: '@@INIT' }) },
        sdk,
        extraMiddlewares: [logger(actions)],
      });
      const dispatch = store.dispatch;
      const getState = store.getState;

      return showListing(id, config)(dispatch, getState, sdk).catch(() => {
        expect(sdk.listings.show.mock.calls).toEqual([
          [
            expect.objectContaining({
              id,
              'imageVariant.listing-card': 'w:400;h:400;fit:crop',
              'imageVariant.listing-card-2x': 'w:800;h:800;fit:crop',
              include: ['author', 'author.profileImage', 'images', 'currentStock'],
            }),
          ],
        ]);

        const relevantActions = actions.filter(
          action => !action.type.startsWith('user/fetchCurrentUser/')
        );

        expect(relevantActions[0].type).toBe('ListingPage/showListing/pending');
        expect(relevantActions[0].meta.arg).toEqual({ listingId: id, config, isOwn: false });

        expect(relevantActions[1].type).toBe('ListingPage/showListing/rejected');
        expect(relevantActions[1].payload).toEqual(storableError(error));
      });
    });
  });

  // Shared parameters for viewing rights loadData tests
  const fakeResponse = resource => ({ data: { data: resource, include: [] } });
  const sdkFn = response => jest.fn(() => Promise.resolve(response));

  const sanitizeConfig = { listingFields };

  it("loadData() for currentUser with full viewing rights loads someone else's listing", () => {
    const currentUser = createCurrentUser('currentUser');
    const testInitialState = {
      ...initialState,
      user: { currentUser },
      auth: { isAuthenticated: true },
    };

    // For users with full viewing rights, ListingPage.showListing
    // uses listings.show endpoint
    const sdk = {
      listings: { show: sdkFn(fakeResponse(listing1)) },
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      authInfo: sdkFn({}),
      reviews: { query: sdkFn(fakeResponse(review)) },
    };

    let actions = [];
    const store = configureStore({
      initialState: testInitialState,
      sdk,
      extraMiddlewares: [logger(actions)],
    });
    const dispatch = store.dispatch;
    const getState = store.getState;

    // Tests the actions that get dispatched to the Redux store when ListingPage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id }, null, config)(dispatch, getState, sdk).then(data => {
      const relevantActions = actions.filter(
        action => !action.type.startsWith('user/fetchCurrentUser/')
      );
      expect(relevantActions[0]).toEqual(
        setInitialValues({ inquiryModalOpenForListingId: null, lineItems: null })
      );
      expect(relevantActions[1].type).toBe('ListingPage/showListing/pending');
      expect(relevantActions[2].type).toBe('ListingPage/fetchReviews/pending');
      expect(relevantActions[3]).toEqual(
        addMarketplaceEntities(fakeResponse(listing1), sanitizeConfig)
      );
      expect(relevantActions[4].type).toBe('auth/authInfo/pending');
      expect(relevantActions[5].type).toBe('ListingPage/showListing/fulfilled');
      expect(relevantActions[6].type).toBe('ListingPage/fetchReviews/fulfilled');
      expect(relevantActions[7].type).toBe('auth/authInfo/fulfilled');
    });
  });

  it("loadData() for currentUser with no viewing rights does not load someone else's listing", () => {
    const currentUser = createCurrentUser('currentUser');
    currentUser.effectivePermissionSet.attributes.read = 'permission/deny';
    const testInitialState = {
      ...initialState,
      user: { currentUser },
      auth: { isAuthenticated: true },
    };

    const error = new Error('Request failed with status code 403');
    error.status = 403;
    error.apiErrors = [
      {
        id: new UUID('asdf'),
        status: 403,
        code: 'user-pending-approval',
        title: 'User pending approval',
      },
    ];

    // For viewing rights restricted users, ListingPage.showListing
    // uses ownListings.show endpoint, which throws 403 when accessing
    // a listing that is not the current user's own
    const sdk = {
      ownListings: { show: jest.fn(() => Promise.reject(error)) },
      listings: { show: jest.fn(() => Promise.reject(error)) },
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      reviews: { query: jest.fn(() => Promise.reject(error)) },
      authInfo: sdkFn({}),
    };

    let actions = [];
    const store = configureStore({
      initialState: testInitialState,
      sdk,
      extraMiddlewares: [logger(actions)],
    });
    const dispatch = store.dispatch;
    const getState = store.getState;

    // Tests the actions that get dispatched to the Redux store when ListingPage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id }, null, config)(dispatch, getState, sdk).catch(e => {
      // Note: catch for loadData is on Routes.js component in practice.
      const relevantActions = actions.filter(
        action => !action.type.startsWith('user/fetchCurrentUser/')
      );
      expect(relevantActions[0]).toEqual(
        setInitialValues({ inquiryModalOpenForListingId: null, lineItems: null })
      );
      expect(relevantActions[2].type).toBe('auth/authInfo/pending');
      expect(relevantActions[3].type).toBe('ListingPage/showListing/rejected');
      expect(relevantActions[4].type).toBe('auth/authInfo/fulfilled');
    });
  });

  it("loadData() for currentUser with no viewing rights loads the user's own listing", () => {
    const currentUser = createCurrentUser('currentUser');
    currentUser.effectivePermissionSet.attributes.read = 'permission/deny';
    const testInitialState = {
      ...initialState,
      user: { currentUser },
      auth: { isAuthenticated: true },
    };
    const error = new Error('Request failed with status code 403');

    // For viewing rights restricted users, ListingPage.showListing
    // users ownListings.show endpoint, which fetches the user's
    // own listings successfully.
    const sdk = {
      ownListings: { show: sdkFn(fakeResponse(listing1Own)) },
      listings: { show: jest.fn(() => Promise.reject(error)) },
      currentUser: { show: sdkFn(fakeResponse(currentUser)) },
      authInfo: sdkFn({}),
    };

    let actions = [];
    const store = configureStore({
      initialState: testInitialState,
      sdk,
      extraMiddlewares: [logger(actions)],
    });
    const dispatch = store.dispatch;
    const getState = store.getState;

    // Tests the actions that get dispatched to the Redux store when ListingPage.duck.js
    // loadData() function is called. If you make customizations to the loadData() logic,
    // update the dispatched actions list in this test accordingly!
    return loadData({ id }, null, config)(dispatch, getState, sdk).then(data => {
      const relevantActions = actions.filter(
        action => !action.type.startsWith('user/fetchCurrentUser/')
      );
      expect(relevantActions[0]).toEqual(
        setInitialValues({ inquiryModalOpenForListingId: null, lineItems: null })
      );
      expect(relevantActions[1].type).toBe('ListingPage/showListing/pending');
      expect(relevantActions[2]).toEqual(
        addMarketplaceEntities(fakeResponse(listing1Own), sanitizeConfig)
      );
      expect(relevantActions[3].type).toBe('auth/authInfo/pending');
      expect(relevantActions[4].type).toBe('ListingPage/showListing/fulfilled');
      expect(relevantActions[5].type).toBe('auth/authInfo/fulfilled');
    });
  });
});

describe('ActionBar', () => {
  it('shows users own listing status', () => {
    const listing = createListing('listing-published', {
      state: LISTING_STATE_PUBLISHED,
    });
    render(
      <ActionBar
        isOwnListing
        listing={listing}
        editParams={{ id: 'id1', slug: 'asdf', type: 'edit', tab: 'details' }}
      />
    );

    expect(screen.getByText('ListingPage.ownListing')).toBeInTheDocument();
    expect(screen.getByText('ListingPage.editListing')).toBeInTheDocument();
  });

  it('shows users own pending listing status', () => {
    const listing = createListing('listing-published', {
      state: LISTING_STATE_PENDING_APPROVAL,
    });
    render(
      <ActionBar
        isOwnListing
        listing={listing}
        editParams={{ id: 'id1', slug: 'asdf', type: 'edit', tab: 'details' }}
      />
    );
    expect(screen.getByText('ListingPage.ownListingPendingApproval')).toBeInTheDocument();
    expect(screen.getByText('ListingPage.editListing')).toBeInTheDocument();
  });

  it('shows users own closed listing status', () => {
    const listing = createListing('listing-closed', {
      state: LISTING_STATE_CLOSED,
    });
    render(
      <ActionBar
        isOwnListing
        listing={listing}
        editParams={{ id: 'id1', slug: 'asdf', type: 'edit', tab: 'details' }}
      />
    );
    expect(screen.getByText('ListingPage.ownClosedListing')).toBeInTheDocument();
    expect(screen.getByText('ListingPage.editListing')).toBeInTheDocument();
  });

  it('shows closed listing status', () => {
    const listing = createListing('listing-closed', {
      state: LISTING_STATE_CLOSED,
    });
    render(
      <ActionBar
        isOwnListing={false}
        listing={listing}
        editParams={{ id: 'id1', slug: 'asdf', type: 'edit', tab: 'details' }}
      />
    );
    expect(screen.getByText('ListingPage.closedListing')).toBeInTheDocument();
  });

  it("is missing if listing is published but not user's own", () => {
    const listing = createListing('listing-published', {
      state: LISTING_STATE_PUBLISHED,
    });
    const actionBar = render(
      <ActionBar
        isOwnListing={false}
        listing={listing}
        editParams={{ id: 'id1', slug: 'asdf', type: 'edit', tab: 'details' }}
      />
    );
    expect(actionBar.asFragment().firstChild).toBeNull();
  });
});

describe('Similar listings', () => {
  const config = {
    layout: { listingImage: { aspectWidth: 4, aspectHeight: 3, variantPrefix: 'listing-card' } },
    listing: { listingFields: jdmListingFields },
  };
  const other = createListing('jdm-listing-2', {
    publicData: { categoryLevel1: 'jdm-cars', make: 'nissan', model: 'nissan-silvia' },
  });

  it('queries the same category, make and model with the card fields', () => {
    const params = similarListingsQueryParams(jdmListing, config);
    expect(params).toEqual(
      expect.objectContaining({
        pub_categoryLevel1: 'jdm-cars',
        pub_make: 'nissan',
        pub_model: 'nissan-silvia',
        perPage: 9,
        'limit.images': 1,
      })
    );
    expect(params['fields.listing']).toEqual(
      expect.arrayContaining(['title', 'price', 'publicData.year', 'publicData.odometer'])
    );
    expect(params).not.toHaveProperty('pub_state');
  });

  it('queries nothing for listings outside the JDM categories', () => {
    expect(similarListingsQueryParams(listing1, config)).toBeNull();
  });

  it('leaves the listing itself out of the results and the store', () => {
    const response = { data: { data: [jdmListing, other], included: [] } };
    const sdk = { listings: { query: jest.fn(() => Promise.resolve(response)) } };
    const actions = [];
    const store = configureStore({
      initialState: { ListingPage: reducer(undefined, { type: '@@INIT' }) },
      sdk,
      extraMiddlewares: [logger(actions)],
    });

    return store.dispatch(fetchSimilarListings(jdmListing, config)).then(() => {
      const added = actions.find(a => a.type === 'marketplaceData/addEntities');
      expect(added.payload.sdkResponse.data.data).toEqual([other]);
      const state = store.getState().ListingPage;
      expect(state.similarListingsForId).toEqual(jdmId);
      expect(state.similarListingIds).toEqual([other.id]);
      expect(state.similarListingsInProgress).toBe(false);
    });
  });

  it('ignores results for a listing the visitor already left', () => {
    const arg = { listing: jdmListing, config };
    const pending = reducer(undefined, fetchSimilarListingsThunk.pending('req1', arg));
    const moved = reducer(
      pending,
      fetchSimilarListingsThunk.pending('req2', { listing: other, config })
    );
    const stale = reducer(moved, fetchSimilarListingsThunk.fulfilled([other.id], 'req1', arg));
    expect(stale.similarListingsForId).toEqual('jdm-listing-2');
    expect(stale.similarListingIds).toEqual([]);
    expect(stale.similarListingsInProgress).toBe(true);
  });
});
