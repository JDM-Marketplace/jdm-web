import {
  clearUnusedOtherFields,
  getJdmCardDetails,
  getJdmListingSpecs,
  modelOptionsForMake,
} from './jdmFields';

const listingFields = [
  {
    key: 'make',
    enumOptions: [{ option: 'nissan', label: 'Nissan' }, { option: 'toyota', label: 'Toyota' }],
  },
  {
    key: 'model',
    enumOptions: [
      { option: 'nissan-skyline', label: 'Skyline' },
      { option: 'toyota-supra', label: 'Supra' },
    ],
  },
  { key: 'condition', enumOptions: [{ option: 'used-good', label: 'Used – Good' }] },
  { key: 'state', enumOptions: [{ option: 'vic', label: 'Victoria' }] },
  { key: 'transmission', enumOptions: [{ option: 'manual', label: 'Manual' }] },
  { key: 'drive_type', enumOptions: [{ option: 'rwd', label: 'RWD' }] },
];
const formatOdometer = km => `${km.toLocaleString('en-AU')} km`;

describe('getJdmCardDetails', () => {
  it('returns year, make and model plus state and odometer for cars', () => {
    const details = getJdmCardDetails(
      { year: 2001, make: 'nissan', model: 'nissan-skyline', state: 'nsw', odometer: 85000 },
      listingFields,
      formatOdometer
    );
    expect(details).toEqual({ heading: '2001 Nissan Skyline', meta: ['NSW', '85,000 km'] });
  });

  it('returns year and make plus state and condition for parts', () => {
    const details = getJdmCardDetails(
      { year: 1998, make: 'toyota', state: 'qld', condition: 'used-good' },
      listingFields,
      formatOdometer
    );
    expect(details).toEqual({ heading: '1998 Toyota', meta: ['QLD', 'Used – Good'] });
  });

  it('returns null for listings without a make', () => {
    expect(getJdmCardDetails({ year: 2001 }, listingFields, formatOdometer)).toBeNull();
  });
});

describe('getJdmCardDetails with part make and typed-in names', () => {
  const fields = [
    ...listingFields,
    { key: 'part_make', enumOptions: [{ option: 'universal', label: 'Universal' }] },
  ];

  it('uses the part make for parts', () => {
    expect(getJdmCardDetails({ part_make: 'universal' }, fields).heading).toEqual('Universal');
  });

  it('uses the typed-in make and model for Others', () => {
    const publicData = { year: 1995, make: 'other', make_other: 'Isuzu', model_other: 'Bighorn' };
    expect(getJdmCardDetails(publicData, fields).heading).toEqual('1995 Isuzu Bighorn');
  });

  it('uses the typed-in model for Other Models', () => {
    const publicData = { make: 'nissan', model: 'nissan-other-models', model_other: 'Leopard' };
    expect(getJdmCardDetails(publicData, fields).heading).toEqual('Nissan Leopard');
  });
});

describe('clearUnusedOtherFields', () => {
  it('clears the typed-in names that the form does not show', () => {
    const fields = {
      make: 'nissan',
      model: 'nissan-silvia',
      make_other: 'Isuzu',
      model_other: 'X',
    };
    expect(clearUnusedOtherFields(fields)).toEqual({
      make: 'nissan',
      model: 'nissan-silvia',
      make_other: null,
      model_other: null,
    });
  });

  it('keeps them for Others and clears the model list value', () => {
    const fields = { make: 'other', model: 'nissan-silvia', make_other: 'Isuzu', model_other: 'X' };
    expect(clearUnusedOtherFields(fields)).toEqual({ ...fields, model: null });
  });

  it('keeps the typed-in model for Other Models', () => {
    const fields = {
      make: 'nissan',
      model: 'nissan-other-models',
      make_other: 'A',
      model_other: 'X',
    };
    expect(clearUnusedOtherFields(fields)).toEqual({ ...fields, make_other: null });
  });

  it('leaves fields of other categories alone', () => {
    expect(clearUnusedOtherFields({ part_make: 'universal', make: null })).toEqual({
      part_make: 'universal',
      make: null,
    });
  });
});

describe('modelOptionsForMake', () => {
  it('has no model list for Others', () => {
    expect(modelOptionsForMake(listingFields[1].enumOptions, 'other')).toEqual([]);
  });

  it('filters models by the make prefix', () => {
    expect(modelOptionsForMake(listingFields[1].enumOptions, 'toyota')).toEqual([
      { option: 'toyota-supra', label: 'Supra' },
    ]);
  });
});

describe('getJdmListingSpecs', () => {
  it('lists car specs in the order of the design, with labels and the odometer', () => {
    const specs = getJdmListingSpecs(
      {
        make: 'nissan',
        model: 'nissan-skyline',
        year: 1999,
        state: 'vic',
        transmission: 'manual',
        drive_type: 'rwd',
        odometer: 85000,
      },
      listingFields,
      formatOdometer
    );
    expect(specs).toEqual([
      { key: 'make', value: 'Nissan' },
      { key: 'model', value: 'Skyline' },
      { key: 'year', value: '1999' },
      { key: 'state', value: 'Victoria' },
      { key: 'transmission', value: 'Manual' },
      { key: 'drive_type', value: 'RWD' },
      { key: 'odometer', value: '85,000 km' },
    ]);
  });

  it('shows the make and model typed in by the seller', () => {
    const typed = { make: 'other', make_other: ' Isuzu ', model_other: 'Gemini' };
    expect(getJdmListingSpecs(typed, listingFields, formatOdometer)).toEqual([
      { key: 'make', value: 'Isuzu' },
      { key: 'model', value: 'Gemini' },
    ]);
    const otherModel = { make: 'nissan', model: 'nissan-other-models', model_other: 'Laurel' };
    expect(getJdmListingSpecs(otherModel, listingFields, formatOdometer)[1]).toEqual({
      key: 'model',
      value: 'Laurel',
    });
  });

  it('lists make, year, location and condition for parts', () => {
    const specs = getJdmListingSpecs(
      { part_make: 'universal', year: 2010, state: 'vic', condition: 'used-good', odometer: 5 },
      listingFields,
      formatOdometer
    );
    expect(specs.map(s => s.key)).toEqual(['part_make', 'year', 'state', 'condition']);
    expect(specs[3].value).toEqual('Used – Good');
  });

  it('returns nothing for listings without a make', () => {
    expect(getJdmListingSpecs({ year: 2001 }, listingFields, formatOdometer)).toEqual([]);
  });
});
