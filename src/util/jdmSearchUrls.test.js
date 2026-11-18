import {
  jdmSeoCanonicalPath,
  jdmSeoLocationFromSearchParams,
  jdmSeoPageMeta,
  jdmSeoUrlForSearch,
  parseJdmSeoPath,
} from './jdmSearchUrls';

const listingFields = [
  {
    key: 'make',
    enumOptions: [
      { option: 'nissan', label: 'Nissan' },
      { option: 'toyota', label: 'Toyota' },
      { option: 'other', label: 'Others' },
    ],
  },
  {
    key: 'part_make',
    enumOptions: [
      { option: 'nissan', label: 'Nissan' },
      { option: 'universal', label: 'Universal' },
      { option: 'other-parts', label: 'Other JDM Car Parts' },
    ],
  },
  {
    key: 'model',
    enumOptions: [
      { option: 'nissan-silvia', label: 'Silvia' },
      { option: 'nissan-180sx', label: '180SX' },
      { option: 'nissan-other-models', label: 'Other Models' },
      { option: 'toyota-86', label: '86' },
    ],
  },
  {
    key: 'state',
    enumOptions: [{ option: 'vic', label: 'Victoria' }, { option: 'int', label: 'Overseas' }],
  },
];

// Formats "JdmSeo.carsModel.heading" with its values, enough to check which message is used
const intl = {
  formatMessage: ({ id }, values = {}) =>
    [id.replace('JdmSeo.', ''), ...Object.values(values).filter(v => v !== '')].join('|'),
};

describe('parseJdmSeoPath', () => {
  it('reads car paths', () => {
    expect(parseJdmSeoPath('jdm-cars', [], listingFields).filters).toEqual({
      pub_categoryLevel1: 'jdm-cars',
    });
    expect(parseJdmSeoPath('jdm-cars', ['nissan'], listingFields).filters).toEqual({
      pub_categoryLevel1: 'jdm-cars',
      pub_make: 'nissan',
    });
    const model = parseJdmSeoPath('jdm-cars', ['nissan', 'silvia', 'page-3'], listingFields);
    expect(model.filters).toEqual({
      pub_categoryLevel1: 'jdm-cars',
      pub_make: 'nissan',
      pub_model: 'nissan-silvia',
    });
    expect(model.page).toEqual(3);
  });

  it('maps the "Others" make to /jdm-cars/other-models/', () => {
    expect(parseJdmSeoPath('jdm-cars', ['other-models'], listingFields).filters.pub_make).toEqual(
      'other'
    );
    expect(parseJdmSeoPath('jdm-cars', ['other'], listingFields)).toBeNull();
    expect(
      parseJdmSeoPath('jdm-cars', ['nissan', 'other-models'], listingFields).filters.pub_model
    ).toEqual('nissan-other-models');
  });

  it('reads part and state paths', () => {
    expect(parseJdmSeoPath('jdm-parts', ['universal'], listingFields).filters).toEqual({
      pub_categoryLevel1: 'jdm-parts',
      pub_part_make: 'universal',
    });
    expect(parseJdmSeoPath('vic', ['page-2'], listingFields)).toMatchObject({
      filters: { pub_state: 'vic' },
      page: 2,
    });
  });

  it('reads the state as the last segment of car and part paths', () => {
    expect(parseJdmSeoPath('jdm-cars', ['vic', 'page-2'], listingFields)).toMatchObject({
      filters: { pub_categoryLevel1: 'jdm-cars', pub_state: 'vic' },
      page: 2,
    });
    expect(parseJdmSeoPath('jdm-cars', ['nissan', 'silvia', 'int'], listingFields).filters).toEqual(
      {
        pub_categoryLevel1: 'jdm-cars',
        pub_make: 'nissan',
        pub_model: 'nissan-silvia',
        pub_state: 'int',
      }
    );
    expect(parseJdmSeoPath('jdm-parts', ['universal', 'vic'], listingFields).filters).toEqual({
      pub_categoryLevel1: 'jdm-parts',
      pub_part_make: 'universal',
      pub_state: 'vic',
    });
    expect(parseJdmSeoPath('jdm-cars', ['vic', 'nissan'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-cars', ['nissan', 'vic', 'int'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-cars', ['nsw'], listingFields)).toBeNull(); // not in Console
  });

  it('returns null for unknown paths', () => {
    expect(parseJdmSeoPath('jdm-cars', ['honda'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-cars', ['nissan', '86'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-cars', ['nissan', 'silvia', 'extra'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-cars', ['page-0'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('jdm-parts', ['toyota'], listingFields)).toBeNull();
    expect(parseJdmSeoPath('nsw', [], listingFields)).toBeNull(); // not in Console
    expect(parseJdmSeoPath('vic', ['nissan'], listingFields)).toBeNull();
  });
});

describe('jdmSeoLocationFromSearchParams', () => {
  const seo = params => jdmSeoLocationFromSearchParams(params, listingFields);

  it('puts category, make and model in the path', () => {
    expect(
      seo({ pub_categoryLevel1: 'jdm-cars', pub_make: 'nissan', pub_model: 'nissan-silvia' })
    ).toEqual({ pathname: '/jdm-cars/nissan/silvia/', searchParams: {}, page: 1 });
    expect(seo({ pub_categoryLevel1: 'jdm-cars', pub_make: 'other' }).pathname).toEqual(
      '/jdm-cars/other-models/'
    );
    expect(seo({ pub_categoryLevel1: 'jdm-parts', pub_part_make: 'other-parts' }).pathname).toEqual(
      '/jdm-parts/other-parts/'
    );
  });

  it('takes the category from a make or part make', () => {
    expect(seo({ pub_make: 'nissan' }).pathname).toEqual('/jdm-cars/nissan/');
    expect(seo({ pub_part_make: 'universal' }).pathname).toEqual('/jdm-parts/universal/');
    expect(seo({ pub_make: 'nissan', pub_transmission: 'manual' })).toEqual({
      pathname: '/jdm-cars/nissan/',
      searchParams: { pub_transmission: 'manual' },
      page: 1,
    });
  });

  it('finds the make from the model', () => {
    expect(seo({ pub_categoryLevel1: 'jdm-cars', pub_model: 'toyota-86' }).pathname).toEqual(
      '/jdm-cars/toyota/86/'
    );
  });

  it('drops a model of another make', () => {
    expect(
      seo({ pub_categoryLevel1: 'jdm-cars', pub_make: 'toyota', pub_model: 'nissan-silvia' })
    ).toEqual({ pathname: '/jdm-cars/toyota/', searchParams: {}, page: 1 });
  });

  it('uses /page-N/ only without other filters', () => {
    expect(seo({ pub_categoryLevel1: 'jdm-cars', page: 2 })).toEqual({
      pathname: '/jdm-cars/page-2/',
      searchParams: {},
      page: 2,
    });
    expect(seo({ pub_categoryLevel1: 'jdm-cars', page: 2, pub_transmission: 'manual' })).toEqual({
      pathname: '/jdm-cars/',
      searchParams: { pub_transmission: 'manual', page: 2 },
      page: 2,
    });
    expect(seo({ pub_categoryLevel1: 'jdm-cars', page: 1 }).pathname).toEqual('/jdm-cars/');
  });

  it('puts a single state last in the path of car and part pages', () => {
    expect(seo({ pub_categoryLevel1: 'jdm-cars', pub_state: 'vic', page: 2 })).toEqual({
      pathname: '/jdm-cars/vic/page-2/',
      searchParams: {},
      page: 2,
    });
    expect(seo({ pub_make: 'nissan', pub_model: 'nissan-silvia', pub_state: 'int' })).toEqual({
      pathname: '/jdm-cars/nissan/silvia/int/',
      searchParams: {},
      page: 1,
    });
    expect(seo({ pub_part_make: 'universal', pub_state: 'vic' }).pathname).toEqual(
      '/jdm-parts/universal/vic/'
    );
    expect(seo({ pub_make: 'nissan,toyota', pub_state: 'vic' })).toEqual({
      pathname: '/jdm-cars/vic/',
      searchParams: { pub_make: 'nissan,toyota' },
      page: 1,
    });
  });

  it('keeps several states as a filter', () => {
    expect(seo({ pub_categoryLevel1: 'jdm-parts', pub_state: 'vic,int' })).toEqual({
      pathname: '/jdm-parts/',
      searchParams: { pub_state: 'vic,int' },
      page: 1,
    });
  });

  it('uses the state page without a category', () => {
    expect(seo({ pub_state: 'int', price: '0,10000' })).toEqual({
      pathname: '/int/',
      searchParams: { price: '0,10000' },
      page: 1,
    });
  });

  it('keeps several values as filters', () => {
    expect(seo({ pub_categoryLevel1: 'jdm-cars', pub_make: 'nissan,toyota' })).toEqual({
      pathname: '/jdm-cars/',
      searchParams: { pub_make: 'nissan,toyota' },
      page: 1,
    });
  });

  it('returns null for searches without an SEO page', () => {
    expect(seo({})).toBeNull();
    expect(seo({ keywords: 'silvia' })).toBeNull();
    expect(seo({ pub_state: 'vic,int' })).toBeNull();
    expect(seo({ pub_categoryLevel1: 'unknown' })).toBeNull();
  });
});

describe('jdmSeoUrlForSearch', () => {
  it('maps /s query strings', () => {
    expect(
      jdmSeoUrlForSearch(
        '?pub_categoryLevel1=jdm-cars&pub_make=nissan&pub_transmission=manual&page=2',
        listingFields
      )
    ).toEqual('/jdm-cars/nissan/?page=2&pub_transmission=manual');
    expect(jdmSeoUrlForSearch('?keywords=silvia', listingFields)).toBeNull();
  });
});

describe('jdmSeoCanonicalPath', () => {
  it('drops filters and the page of filtered URLs', () => {
    expect(jdmSeoCanonicalPath('/jdm-cars/honda/civic/', '?pub_transmission=manual')).toEqual(
      '/jdm-cars/honda/civic/'
    );
    expect(jdmSeoCanonicalPath('/jdm-cars/page-2/', '?pub_transmission=manual')).toEqual(
      '/jdm-cars/'
    );
  });

  it('keeps unfiltered paginated URLs', () => {
    expect(jdmSeoCanonicalPath('/jdm-cars/page-2/', '')).toEqual('/jdm-cars/page-2/');
    expect(jdmSeoCanonicalPath('/vic', '')).toEqual('/vic/');
  });
});

describe('jdmSeoPageMeta', () => {
  const meta = (root, segments) =>
    jdmSeoPageMeta(parseJdmSeoPath(root, segments, listingFields), intl, 'JDM Marketplace');

  it('uses the model pattern and breadcrumbs', () => {
    const { heading, breadcrumbs } = meta('jdm-cars', ['nissan', 'silvia']);
    expect(heading).toEqual('carsModel.heading|Nissan|Silvia');
    expect(breadcrumbs.map(b => b.path)).toEqual([
      '/',
      '/jdm-cars/',
      '/jdm-cars/nissan/',
      '/jdm-cars/nissan/silvia/',
    ]);
  });

  it('uses the "other" patterns', () => {
    expect(meta('jdm-cars', ['nissan', 'other-models']).heading).toMatch(/^carsOtherModels/);
    expect(meta('jdm-cars', ['other-models']).heading).toMatch(/^carsOtherMake/);
    expect(meta('jdm-parts', ['universal']).heading).toMatch(/^partsUniversal/);
    expect(meta('jdm-parts', ['other-parts']).breadcrumbs[2].label).toEqual('Other JDM Car Parts');
    expect(meta('jdm-parts', ['nissan']).breadcrumbs[2].label).toEqual(
      'breadcrumbPartsMake|Nissan'
    );
  });

  it('uses the state patterns and ends the breadcrumbs with the state', () => {
    expect(meta('jdm-cars', ['vic']).heading).toEqual('carsState.heading|location.vic');
    const { heading, breadcrumbs } = meta('jdm-cars', ['nissan', 'silvia', 'vic']);
    expect(heading).toEqual('carsModelState.heading|Nissan|Silvia|location.vic');
    expect(breadcrumbs.map(b => b.path)).toEqual([
      '/',
      '/jdm-cars/',
      '/jdm-cars/nissan/',
      '/jdm-cars/nissan/silvia/',
      '/jdm-cars/nissan/silvia/vic/',
    ]);
    expect(meta('vic', []).breadcrumbs.map(b => b.path)).toEqual(['/', '/vic/']);
  });

  it('adds the page number to paginated pages', () => {
    expect(meta('vic', ['page-2']).title).toEqual(
      'title|state.vic.heading|pageSuffix|2|JDM Marketplace'
    );
    expect(meta('vic', []).title).toEqual('title|state.vic.heading|JDM Marketplace');
  });
});
