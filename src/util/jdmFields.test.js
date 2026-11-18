import { getJdmCardDetails, modelOptionsForMake } from './jdmFields';

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

describe('modelOptionsForMake', () => {
  it('filters models by the make prefix', () => {
    expect(modelOptionsForMake(listingFields[1].enumOptions, 'toyota')).toEqual([
      { option: 'toyota-supra', label: 'Supra' },
    ]);
  });
});
