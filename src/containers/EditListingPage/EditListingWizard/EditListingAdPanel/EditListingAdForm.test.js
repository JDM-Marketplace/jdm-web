import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingAdForm, { modelOptionsForMake } from './EditListingAdForm';

const { screen, userEvent, waitFor } = testingLibrary;

const noop = () => null;

const listingType = {
  listingType: 'jdm',
  transactionProcessAlias: 'default-inquiry/release-1',
  unitType: 'inquiry',
  label: 'JDM',
};

const categories = [{ id: 'jdm-cars', name: 'JDM Cars' }, { id: 'jdm-parts', name: 'JDM Parts' }];

const field = (key, label, categoryIds, extra) => ({
  key,
  scope: 'public',
  schemaType: 'enum',
  listingTypeConfig: { limitToListingTypeIds: false },
  categoryConfig: { limitToCategoryIds: true, categoryIds },
  saveConfig: { label, isRequired: true },
  showConfig: { label },
  filterConfig: { label },
  label,
  ...extra,
});

const listingFieldsConfig = [
  field('make', 'Make', ['jdm-cars', 'jdm-parts'], {
    enumOptions: [{ option: 'nissan', label: 'Nissan' }, { option: 'toyota', label: 'Toyota' }],
  }),
  field('model', 'Model', ['jdm-cars'], {
    enumOptions: [
      { option: 'nissan-skyline', label: 'Skyline' },
      { option: 'nissan-silvia', label: 'Silvia' },
      { option: 'toyota-supra', label: 'Supra' },
    ],
  }),
  field('transmission', 'Transmission', ['jdm-cars'], {
    enumOptions: [{ option: 'manual', label: 'Manual' }],
  }),
  field('condition', 'Condition', ['jdm-parts'], {
    enumOptions: [{ option: 'new', label: 'New' }],
  }),
];

const renderForm = (initialValues = {}, onSubmit = noop) =>
  render(
    <EditListingAdForm
      initialValues={{
        listingType: listingType.listingType,
        transactionProcessAlias: listingType.transactionProcessAlias,
        unitType: listingType.unitType,
        categoryLevel1: 'jdm-cars',
        images: [],
        ...initialValues,
      }}
      onSubmit={onSubmit}
      saveActionMsg="Submit"
      selectableListingTypes={[listingType]}
      hasPredefinedListingType={false}
      selectableCategories={categories}
      categoryPrefix="categoryLevel"
      listingFieldsConfig={listingFieldsConfig}
      currency="AUD"
      images={[]}
      onImageUpload={() => Promise.resolve()}
      onRemoveImage={noop}
      listingImageConfig={{ aspectWidth: 4, aspectHeight: 3, variantPrefix: 'listing-card' }}
      maxImages={15}
      fetchErrors={{}}
    />
  );

describe('modelOptionsForMake', () => {
  const options = listingFieldsConfig[1].enumOptions;

  it('returns no models before a make is chosen', () => {
    expect(modelOptionsForMake(options, undefined)).toEqual([]);
  });

  it('returns only the models of the chosen make', () => {
    expect(modelOptionsForMake(options, 'nissan').map(o => o.option)).toEqual([
      'nissan-skyline',
      'nissan-silvia',
    ]);
  });

  it('falls back to all models when a make has none of its own', () => {
    expect(modelOptionsForMake(options, 'mazda')).toHaveLength(3);
  });
});

describe('EditListingAdForm', () => {
  it('shows car fields for JDM Cars and part fields for JDM Parts', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Transmission')).toBeInTheDocument();
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/JDM Parts/));

    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Transmission')).not.toBeInTheDocument();
  });

  it('enables Model after a Make is chosen and lists only its models', async () => {
    const user = userEvent.setup();
    renderForm();

    const model = screen.getByLabelText('Model');
    expect(model).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Make'), 'nissan');

    expect(model).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Skyline' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Supra' })).not.toBeInTheDocument();
  });

  it('clears the model when the make changes to another make', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText('Make'), 'nissan');
    await user.selectOptions(screen.getByLabelText('Model'), 'nissan-skyline');
    expect(screen.getByLabelText('Model')).toHaveValue('nissan-skyline');

    await user.selectOptions(screen.getByLabelText('Make'), 'toyota');

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toHaveValue('');
    });
  });

  it('does not submit an empty form and shows required errors', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderForm({}, onSubmit);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('EditListingAdForm.titleRequired')).toBeInTheDocument();
    expect(screen.getByText('EditListingAdForm.priceRequired')).toBeInTheDocument();
    expect(screen.getByText('EditListingPhotosForm.imageRequired')).toBeInTheDocument();
  });
});
