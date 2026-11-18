import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Field, Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import { getIn } from 'final-form';
import classNames from 'classnames';

// Import util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import appSettings from '../../../../config/settings';
import { EXTENDED_DATA_SCHEMA_TYPES, SCHEMA_TYPE_LONG } from '../../../../util/types';
import { isFieldForCategory, isFieldForListingType } from '../../../../util/fieldHelpers';
import { isUploadImageOverLimitError } from '../../../../util/errors';
import { formatMoney } from '../../../../util/currency';
import { types as sdkTypes } from '../../../../util/sdkLoader';
import * as validators from '../../../../util/validators';

// Import shared components
import {
  Form,
  Button,
  FieldSelect,
  FieldTextInput,
  FieldCurrencyInput,
  CustomExtendedDataField,
} from '../../../../components';

// Import modules from this directory
import { FieldSelectListingType } from '../EditListingDetailsPanel/EditListingDetailsForm';
import ListingImagesField from '../EditListingPhotosPanel/ListingImagesField';
import { listingImageIdString, listingImageApiId } from '../../EditListingPage.shared';
import css from './EditListingAdForm.module.css';

const { Money } = sdkTypes;

export const TITLE_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 400;
const YEAR_FIELD_KEY = 'year';
const MAKE_FIELD_KEY = 'make';
const MODEL_FIELD_KEY = 'model';

// Where known listing fields go in the 3-column layout of the design.
// Fields that are not listed here (e.g. new fields added in Console later)
// are rendered in their own row after these, so nothing is ever hidden.
const VEHICLE_ROW = [MAKE_FIELD_KEY, MODEL_FIELD_KEY, YEAR_FIELD_KEY];
const LISTING_ROW = ['price', 'state', 'odometer', 'condition'];
const SPECS_ROW = ['body_type', 'drive_type', 'transmission'];
const PLACED_FIELD_KEYS = [...VEHICLE_ROW, ...LISTING_ROW, ...SPECS_ROW];

const messageOrNull = (intl, id, values) =>
  intl.messages?.[id] ? intl.formatMessage({ id }, values) : null;

const namespacedKey = fieldConfig =>
  fieldConfig.scope === 'private' ? `priv_${fieldConfig.key}` : `pub_${fieldConfig.key}`;

// Model options are tied to a make by their id prefix: "nissan-skyline" belongs to "nissan".
// If a make has no prefixed models (e.g. a new make added in Console), all models are shown.
export const modelOptionsForMake = (enumOptions = [], make) => {
  if (!make) {
    return [];
  }
  const forMake = enumOptions.filter(o => `${o.option}`.startsWith(`${make}-`));
  return forMake.length > 0 ? forMake : enumOptions;
};

const yearOptions = (minimum = 1950, maximum) => {
  const nextYear = new Date().getFullYear() + 1;
  const max = Math.min(maximum || nextYear, nextYear);
  const years = [];
  for (let y = max; y >= minimum; y--) {
    years.push(y);
  }
  return years;
};

const parseInteger = value => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const ErrorMessages = props => {
  const { fetchErrors } = props;
  const {
    createListingDraftError,
    updateListingError,
    publishListingError,
    showListingsError,
    uploadImageError,
  } = fetchErrors || {};
  const id = createListingDraftError
    ? 'EditListingAdForm.createListingDraftError'
    : publishListingError
    ? 'EditListingAdForm.publishListingFailed'
    : updateListingError
    ? 'EditListingAdForm.updateFailed'
    : showListingsError
    ? 'EditListingAdForm.showListingFailed'
    : isUploadImageOverLimitError(uploadImageError)
    ? 'EditListingPhotosForm.imageUploadFailed.uploadOverLimit'
    : uploadImageError
    ? 'EditListingPhotosForm.imageUploadFailed.uploadFailed'
    : null;

  return id ? (
    <p className={css.error} role="alert">
      <FormattedMessage id={id} />
    </p>
  ) : null;
};

// "Type of ad": top-level categories as large radio cards.
const FieldAdType = props => {
  const { name, categories, onChange, intl } = props;
  const legendId = `${name}-legend`;
  return (
    <fieldset className={css.adTypeFieldset} aria-labelledby={legendId}>
      <legend id={legendId} className={css.label}>
        <FormattedMessage id="EditListingAdForm.adTypeLabel" />
      </legend>
      <div className={css.adTypeOptions}>
        {categories.map(category => {
          const id = `${name}-${category.id}`;
          const description = messageOrNull(
            intl,
            `EditListingAdForm.adTypeDescription.${category.id}`
          );
          return (
            <Field key={category.id} name={name} type="radio" value={category.id}>
              {({ input }) => (
                <label
                  htmlFor={id}
                  className={classNames(css.adTypeCard, {
                    [css.adTypeCardSelected]: input.checked,
                  })}
                >
                  <input
                    {...input}
                    id={id}
                    className={css.adTypeInput}
                    onChange={e => {
                      input.onChange(e);
                      onChange(category.id);
                    }}
                  />
                  <span className={css.adTypeRadio} aria-hidden="true" />
                  <span className={css.adTypeText}>
                    <span className={css.adTypeName}>{category.name}</span>
                    {description ? (
                      <span className={css.adTypeDescription}>{description}</span>
                    ) : null}
                  </span>
                </label>
              )}
            </Field>
          );
        })}
      </div>
    </fieldset>
  );
};

// Subcategory selects for categories that have children (none at the moment, but
// they work if subcategories are added in Console).
const SubcategoryFields = props => {
  const { options, level, values, prefix, onChange, intl } = props;
  const name = `${prefix}${level}`;
  const selected = options.find(c => c.id === values[name]);
  return (
    <>
      <FieldSelect
        id={name}
        name={name}
        className={css.subcategory}
        label={intl.formatMessage({ id: 'EditListingAdForm.subcategoryLabel' })}
        onChange={() => onChange(level)}
        validate={validators.required(
          intl.formatMessage({ id: 'EditListingAdForm.subcategoryRequired' })
        )}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'EditListingAdForm.subcategoryPlaceholder' })}
        </option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </FieldSelect>
      {selected?.subcategories?.length > 0 ? (
        <SubcategoryFields {...props} options={selected.subcategories} level={level + 1} />
      ) : null}
    </>
  );
};

// Returns true when the deepest category level of the current selection has a value.
const isCategoryPathComplete = (categories, values, prefix) => {
  let options = categories;
  let level = 1;
  while (options?.length > 0) {
    const selected = options.find(c => c.id === values[`${prefix}${level}`]);
    if (!selected) {
      return false;
    }
    options = selected.subcategories;
    level++;
  }
  return true;
};

const fieldLabel = fieldConfig =>
  `${fieldConfig.saveConfig?.label || fieldConfig.label || fieldConfig.key}`;

// Adds the form's placeholder and required messages, unless they are set in Console.
const withFormMessages = (fieldConfig, intl, rendersAsSelect) => {
  const { saveConfig = {}, key, schemaType } = fieldConfig;
  const label = fieldLabel(fieldConfig).toLowerCase();
  // Number fields are free inputs, except Year which is rendered as a dropdown.
  const isSelect = rendersAsSelect ?? schemaType !== SCHEMA_TYPE_LONG;
  const placeholderMessage =
    saveConfig.placeholderMessage ||
    messageOrNull(intl, `EditListingAdForm.placeholder.${key}`) ||
    (isSelect
      ? intl.formatMessage({ id: 'EditListingAdForm.selectPlaceholder' }, { label })
      : null);
  const requiredMessage =
    saveConfig.requiredMessage ||
    messageOrNull(intl, `EditListingAdForm.required.${key}`) ||
    intl.formatMessage(
      { id: isSelect ? 'EditListingAdForm.requiredSelect' : 'EditListingAdForm.requiredEnter' },
      { label }
    );
  return {
    ...fieldConfig,
    saveConfig: {
      ...saveConfig,
      ...(placeholderMessage ? { placeholderMessage } : {}),
      requiredMessage,
    },
  };
};

// Model and Year are always rendered as dropdowns.
const requiredValidatorMaybe = (fieldConfig, intl) => {
  const { isRequired, requiredMessage } = withFormMessages(fieldConfig, intl, true).saveConfig;
  return isRequired ? { validate: validators.required(requiredMessage) } : {};
};

// Model: only shows the models of the selected make, disabled until a make is chosen.
const FieldModel = props => {
  const { fieldConfig, name, make, formId, intl } = props;
  const label = fieldConfig.saveConfig?.label || fieldConfig.label;
  const options = modelOptionsForMake(fieldConfig.enumOptions, make);
  const placeholder = make
    ? intl.formatMessage(
        { id: 'EditListingAdForm.selectPlaceholder' },
        { label: `${label}`.toLowerCase() }
      )
    : intl.formatMessage({ id: 'EditListingAdForm.modelPlaceholderNoMake' });
  return (
    <FieldSelect
      id={`${formId}.${name}`}
      name={name}
      label={label}
      disabled={!make}
      showLabelAsDisabled={!make}
      {...requiredValidatorMaybe(fieldConfig, intl)}
    >
      <option disabled value="">
        {placeholder}
      </option>
      {options.map(o => (
        <option key={o.option} value={o.option}>
          {o.label}
        </option>
      ))}
    </FieldSelect>
  );
};

// Year: a dropdown (newest first) instead of a free number input.
const FieldYear = props => {
  const { fieldConfig, name, formId, intl } = props;
  const label = fieldConfig.saveConfig?.label || fieldConfig.label;
  const { minimum, maximum } = fieldConfig.numberConfig || {};
  return (
    <FieldSelect
      id={`${formId}.${name}`}
      name={name}
      label={label}
      parse={parseInteger}
      format={value => (value == null ? '' : `${value}`)}
      {...requiredValidatorMaybe(fieldConfig, intl)}
    >
      <option disabled value="">
        {intl.formatMessage(
          { id: 'EditListingAdForm.selectPlaceholder' },
          { label: `${label}`.toLowerCase() }
        )}
      </option>
      {yearOptions(minimum, maximum).map(year => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </FieldSelect>
  );
};

const ListingField = props => {
  const { fieldConfig, values, formId, intl } = props;
  const name = namespacedKey(fieldConfig);
  const { key, schemaType } = fieldConfig;

  if (key === MODEL_FIELD_KEY) {
    const make = values[`pub_${MAKE_FIELD_KEY}`];
    return (
      <FieldModel fieldConfig={fieldConfig} name={name} make={make} formId={formId} intl={intl} />
    );
  }
  if (key === YEAR_FIELD_KEY && schemaType === SCHEMA_TYPE_LONG) {
    return <FieldYear fieldConfig={fieldConfig} name={name} formId={formId} intl={intl} />;
  }
  return (
    <CustomExtendedDataField
      name={name}
      fieldConfig={withFormMessages(fieldConfig, intl)}
      formId={formId}
    />
  );
};

// Clears the selected model if it doesn't belong to the newly selected make.
const ModelResetOnMakeChange = props => {
  const { make, form } = props;
  const previousMake = useRef(make);
  useEffect(() => {
    if (previousMake.current !== make) {
      const modelName = `pub_${MODEL_FIELD_KEY}`;
      const model = form.getState().values[modelName];
      if (model && !`${model}`.startsWith(`${make}-`)) {
        form.change(modelName, undefined);
      }
    }
    previousMake.current = make;
  }, [make, form]);
  return null;
};

const PriceField = props => {
  const { formId, currency, listingMinimumPriceSubUnits, intl } = props;
  const priceRequired = validators.required(
    intl.formatMessage({ id: 'EditListingAdForm.priceRequired' })
  );
  const minPrice = formatMoney(intl, new Money(listingMinimumPriceSubUnits || 0, currency));
  const validate = listingMinimumPriceSubUnits
    ? validators.composeValidators(
        priceRequired,
        validators.moneySubUnitAmountAtLeast(
          intl.formatMessage({ id: 'EditListingAdForm.priceTooLow' }, { minPrice }),
          listingMinimumPriceSubUnits
        )
      )
    : priceRequired;

  return (
    <FieldCurrencyInput
      id={`${formId}.price`}
      name="price"
      label={intl.formatMessage({ id: 'EditListingAdForm.priceLabel' }, { currency })}
      placeholder={intl.formatMessage({ id: 'EditListingAdForm.pricePlaceholder' })}
      currencyConfig={appSettings.getCurrencyFormatting(currency)}
      validate={validate}
    />
  );
};

const FieldRow = props => {
  const { children } = props;
  const items = React.Children.toArray(children).filter(Boolean);
  return items.length > 0 ? <div className={css.row}>{items}</div> : null;
};

const DescriptionField = props => {
  const { formId, length, intl } = props;
  const countId = `${formId}.descriptionCount`;
  return (
    <div className={css.field}>
      <FieldTextInput
        id={`${formId}.description`}
        name="description"
        type="textarea"
        label={intl.formatMessage({ id: 'EditListingAdForm.descriptionLabel' })}
        placeholder={intl.formatMessage({ id: 'EditListingAdForm.descriptionPlaceholder' })}
        maxLength={DESCRIPTION_MAX_LENGTH}
        aria-describedby={countId}
        validate={validators.maxLength(
          intl.formatMessage(
            { id: 'EditListingAdForm.maxLength' },
            { maxLength: DESCRIPTION_MAX_LENGTH }
          ),
          DESCRIPTION_MAX_LENGTH
        )}
      />
      <p
        id={countId}
        className={classNames(css.counter, {
          [css.counterLimit]: length >= DESCRIPTION_MAX_LENGTH,
        })}
      >
        <FormattedMessage
          id="EditListingAdForm.descriptionCount"
          values={{ count: length, max: DESCRIPTION_MAX_LENGTH }}
        />
      </p>
    </div>
  );
};

// Photos: wide drop zone + sortable thumbnails (the template's photo field).
const PhotosSection = props => {
  const { imageCount, maxImages, ...imageFieldProps } = props;
  return (
    <div className={css.photos}>
      <div className={css.photosHeader}>
        <span className={css.label}>
          <FormattedMessage id="EditListingAdForm.photosLabel" />
        </span>
        {typeof maxImages === 'number' ? (
          <span className={css.photosCount}>
            <FormattedMessage
              id="EditListingAdForm.photosCount"
              values={{ count: imageCount, max: maxImages }}
            />
          </span>
        ) : null}
      </div>
      <ListingImagesField
        {...imageFieldProps}
        maxImages={maxImages}
        variant="dropzone"
        addImageLabel={
          <>
            <span className={css.dropzoneTitle}>
              <FormattedMessage id="EditListingAdForm.dropzoneTitle" />
            </span>
            <span className={css.dropzoneHint}>
              <FormattedMessage id="EditListingAdForm.dropzoneHint" values={{ maxImages }} />
            </span>
          </>
        }
      />
      <p className={css.photosTip}>
        <FormattedMessage id="EditListingAdForm.photosTip" />
      </p>
    </div>
  );
};

// Comparable snapshot of the form values. Photos are compared by their API image id and the
// price by amount, because the saved listing returns new objects for the same data.
const valuesSnapshot = values => {
  const { images = [], price, addImage, ...rest } = values || {};
  return JSON.stringify({
    ...rest,
    price: price ? { amount: price.amount, currency: price.currency } : null,
    images: images.map(image => listingImageIdString(listingImageApiId(image))),
  });
};

// Scrolls to and focuses the first field with a validation error.
const focusFirstError = (formElement, errors) => {
  if (!formElement || !errors) {
    return;
  }
  const hasError = name => (name === 'addImage' ? !!errors.images : !!getIn(errors, name));
  const first = Array.from(formElement.elements).find(el => el.name && hasError(el.name));
  if (first) {
    const target = first.closest('fieldset') || first;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first.focus({ preventScroll: true });
  }
};

/**
 * Single-page "Customise your ad" form: ad type (category), vehicle and listing details,
 * price and photos in one go.
 *
 * Listing fields come from the hosted listing fields config and are filtered by the selected
 * listing type and category, like in the template's details form.
 *
 * @component
 * @param {Object} props
 * @returns {JSX.Element}
 */
const EditListingAdForm = props => {
  const intl = useIntl();
  const formRef = useRef(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  // What was last sent to the API, to show the "saved" tick until something changes again.
  const [submittedSnapshot, setSubmittedSnapshot] = useState(null);

  const {
    listingFieldsConfig = [],
    selectableCategories = [],
    categoryPrefix,
    initialValues,
  } = props;

  // Compare initial values by content so that a re-render with equal data doesn't reinitialize.
  const initialValuesEqual = useMemo(() => (a, b) => JSON.stringify(a) === JSON.stringify(b), []);

  return (
    <FinalForm
      {...props}
      onSubmit={values => {
        setSubmittedSnapshot(valuesSnapshot(values));
        return props.onSubmit(values);
      }}
      initialValues={initialValues}
      initialValuesEqual={initialValuesEqual}
      // Keep typed values and image order when uploads update the initial values
      keepDirtyOnReinitialize
      mutators={{ ...arrayMutators }}
      render={formRenderProps => {
        const {
          className,
          formId = 'EditListingAdForm',
          form,
          handleSubmit,
          values,
          errors,
          disabled,
          ready,
          pristine,
          updated,
          updateInProgress,
          fetchErrors,
          saveActionMsg,
          selectableListingTypes,
          hasPredefinedListingType,
          onListingTypeChange,
          currency,
          listingMinimumPriceSubUnits,
          images,
          onImageUpload,
          onRemoveImage,
          listingImageConfig,
          maxImages,
          showPrice = true,
          showDescription = true,
          showPhotos = true,
        } = formRenderProps;

        const { listingType } = values;
        const level1Name = `${categoryPrefix}1`;
        const selectedTopCategory = selectableCategories.find(c => c.id === values[level1Name]);
        const hasCategories = selectableCategories.length > 0;
        const categoryPathComplete = hasCategories
          ? isCategoryPathComplete(selectableCategories, values, categoryPrefix)
          : true;
        const showDetails = !!listingType && categoryPathComplete;

        const selectedCategoryIds = [1, 2, 3]
          .map(level => values[`${categoryPrefix}${level}`])
          .filter(Boolean);

        const activeFields = listingFieldsConfig.filter(fieldConfig => {
          const { schemaType, scope } = fieldConfig || {};
          return (
            EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType) &&
            ['public', 'private'].includes(scope) &&
            isFieldForListingType(listingType, fieldConfig) &&
            isFieldForCategory(selectedCategoryIds, fieldConfig)
          );
        });
        const fieldByKey = key => activeFields.find(f => f.key === key);
        const renderField = key => {
          if (key === 'price') {
            return !showPrice ? null : (
              <PriceField
                key="price"
                formId={formId}
                currency={currency}
                listingMinimumPriceSubUnits={listingMinimumPriceSubUnits}
                intl={intl}
              />
            );
          }
          const fieldConfig = fieldByKey(key);
          return fieldConfig ? (
            <ListingField
              key={key}
              fieldConfig={fieldConfig}
              values={values}
              formId={formId}
              intl={intl}
            />
          ) : null;
        };
        const otherFields = activeFields.filter(f => !PLACED_FIELD_KEYS.includes(f.key));

        // When the ad type changes, clear the subcategories below it.
        const clearCategoriesBelow = level => {
          [1, 2, 3]
            .filter(l => l > level)
            .forEach(l => form.change(`${categoryPrefix}${l}`, undefined));
        };

        const titlePlaceholder =
          messageOrNull(intl, `EditListingAdForm.titlePlaceholder.${values[level1Name]}`) ||
          intl.formatMessage({ id: 'EditListingAdForm.titlePlaceholder' });

        const submitInProgress = updateInProgress;
        // `pristine` alone isn't enough: newly added photos stay "dirty" after saving.
        const unchangedSinceSubmit =
          pristine || (submittedSnapshot != null && submittedSnapshot === valuesSnapshot(values));
        const submitReady = (updated && unchangedSinceSubmit) || ready;
        const submitDisabled = disabled || submitInProgress || uploadInProgress || ready;

        return (
          <Form
            className={classNames(css.root, className)}
            onSubmit={e => {
              const result = handleSubmit(e);
              if (form.getState().invalid) {
                // Wait for the error messages to render, so the scroll isn't interrupted.
                window.requestAnimationFrame(() =>
                  focusFirstError(formRef.current, form.getState().errors)
                );
              }
              return result;
            }}
            contentRef={formRef}
            noValidate
          >
            <FieldSelectListingType
              name="listingType"
              listingTypes={selectableListingTypes}
              hasPredefinedListingType={hasPredefinedListingType}
              onListingTypeChange={onListingTypeChange}
              formApi={form}
              formId={formId}
              intl={intl}
            />

            {hasCategories && listingType ? (
              <div className={css.section}>
                <FieldAdType
                  name={level1Name}
                  categories={selectableCategories}
                  onChange={() => clearCategoriesBelow(1)}
                  intl={intl}
                />
                {selectedTopCategory?.subcategories?.length > 0 ? (
                  <SubcategoryFields
                    options={selectedTopCategory.subcategories}
                    level={2}
                    values={values}
                    prefix={categoryPrefix}
                    onChange={clearCategoriesBelow}
                    intl={intl}
                  />
                ) : null}
              </div>
            ) : null}

            {showDetails ? (
              <>
                {fieldByKey(MODEL_FIELD_KEY) ? (
                  <ModelResetOnMakeChange make={values[`pub_${MAKE_FIELD_KEY}`]} form={form} />
                ) : null}
                <FieldRow>{VEHICLE_ROW.map(renderField)}</FieldRow>

                <FieldTextInput
                  id={`${formId}.title`}
                  name="title"
                  className={css.field}
                  type="text"
                  label={intl.formatMessage({ id: 'EditListingAdForm.titleLabel' })}
                  placeholder={titlePlaceholder}
                  maxLength={TITLE_MAX_LENGTH}
                  validate={validators.composeValidators(
                    validators.required(
                      intl.formatMessage({ id: 'EditListingAdForm.titleRequired' })
                    ),
                    validators.maxLength(
                      intl.formatMessage(
                        { id: 'EditListingAdForm.maxLength' },
                        { maxLength: TITLE_MAX_LENGTH }
                      ),
                      TITLE_MAX_LENGTH
                    )
                  )}
                />

                {showDescription ? (
                  <DescriptionField
                    formId={formId}
                    length={(values.description || '').length}
                    intl={intl}
                  />
                ) : null}

                <FieldRow>{LISTING_ROW.map(renderField)}</FieldRow>
                <FieldRow>{SPECS_ROW.map(renderField)}</FieldRow>
                <FieldRow>{otherFields.map(f => renderField(f.key))}</FieldRow>

                {showPhotos ? (
                  <PhotosSection
                    form={form}
                    imageCount={(values.images || []).length}
                    images={images}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                    listingImageConfig={listingImageConfig}
                    maxImages={maxImages}
                    onUploadStateChange={setUploadInProgress}
                  />
                ) : null}
              </>
            ) : null}

            <ErrorMessages fetchErrors={fetchErrors} />

            <div className={css.submitSection}>
              <Button
                className={css.submitButton}
                type="submit"
                inProgress={submitInProgress}
                disabled={submitDisabled}
                ready={submitReady}
              >
                {saveActionMsg}
              </Button>
              {uploadInProgress ? (
                <p className={css.uploadingNote}>
                  <FormattedMessage id="EditListingAdForm.waitForUploads" />
                </p>
              ) : null}
            </div>
          </Form>
        );
      }}
    />
  );
};

export default EditListingAdForm;
