import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import isEqual from 'lodash/isEqual';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { propTypes } from '../../../../util/types';
import { isUploadImageOverLimitError } from '../../../../util/errors';

// Import shared components
import { Button, Form, NamedLink } from '../../../../components';

// Import modules from this directory
import ListingImagesField from './ListingImagesField';
import css from './EditListingPhotosForm.module.css';

// Kept as a named export for backwards compatibility
export { FieldAddImage } from './ListingImagesField';

const ImageUploadError = props => {
  return props.uploadOverLimit ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.imageUploadFailed.uploadOverLimit" />
    </p>
  ) : props.uploadImageError ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.imageUploadFailed.uploadFailed" />
    </p>
  ) : null;
};

// NOTE: PublishListingError and ShowListingsError are here since Photos panel is the last visible panel
// before creating a new listing. If that order is changed, these should be changed too.
// Create and show listing errors are shown above submit button
const PublishListingError = props => {
  return props.error ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.publishListingFailed" />
    </p>
  ) : null;
};

const ShowListingsError = props => {
  return props.error ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.showListingFailed" />
    </p>
  ) : null;
};

/**
 * The EditListingPhotosForm component.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {boolean} props.updated - Whether the form is updated
 * @param {boolean} props.updateInProgress - Whether the update is in progress
 * @param {Object} props.fetchErrors - The fetch errors object
 * @param {propTypes.error} props.fetchErrors.publishListingError - The publish listing error
 * @param {propTypes.error} props.fetchErrors.showListingsError - The show listings error
 * @param {propTypes.error} props.fetchErrors.uploadImageError - The upload image error
 * @param {propTypes.error} props.fetchErrors.updateListingError - The update listing error
 * @param {string} props.saveActionMsg - The save action message
 * @param {Function} props.onSubmit - The submit function
 * @param {Function} props.onImageUpload - The image upload function
 * @param {Function} props.onRemoveImage - The remove image function
 * @param {Object} props.listingImageConfig - The listing image config
 * @param {number} props.listingImageConfig.aspectWidth - The aspect width
 * @param {number} props.listingImageConfig.aspectHeight - The aspect height
 * @param {string} props.listingImageConfig.variantPrefix - The variant prefix
 * @returns {JSX.Element}
 */
export const EditListingPhotosForm = props => {
  const [submittedImages, setSubmittedImages] = useState([]);
  const [imageUploadRequested, setImageUploadRequested] = useState(false);
  const intl = useIntl();

  return (
    <FinalForm
      {...props}
      // Without this, reordering gets silently reverted when initialValues
      // recomputes (e.g. another photo finishing upload). Applies to the whole
      // form, not just "images" - a future field here inherits this too.
      keepDirtyOnReinitialize
      mutators={{ ...arrayMutators }}
      render={formRenderProps => {
        const {
          form,
          className,
          fetchErrors,
          handleSubmit,
          invalid,
          onRemoveImage,
          disabled,
          ready,
          saveActionMsg,
          updated,
          updateInProgress,
          values,
          listingImageConfig,
          maxImages,
          allFilesUploadedAndVerified,
          filesTabParams,
          filesRequired,
        } = formRenderProps;

        const images = values.images || [];
        const hasImageLimit = typeof maxImages === 'number';
        const isOverImageLimit = hasImageLimit && images.length > maxImages;

        const { publishListingError, showListingsError, updateListingError, uploadImageError } =
          fetchErrors || {};
        const uploadOverLimit = isUploadImageOverLimitError(uploadImageError);

        // imgs can contain added images (with temp ids) and submitted images with uniq ids.
        const arrayOfImgIds = imgs => imgs?.map(i => (typeof i.id === 'string' ? i.imageId : i.id));
        const imageIdsFromProps = arrayOfImgIds(images);
        const imageIdsFromPreviousSubmit = arrayOfImgIds(submittedImages);
        const imageArrayHasSameImages = isEqual(imageIdsFromProps, imageIdsFromPreviousSubmit);
        const submittedOnce = submittedImages.length > 0;
        const pristineSinceLastSubmit = submittedOnce && imageArrayHasSameImages;

        const submitReady = (updated && pristineSinceLastSubmit) || ready;
        const submitInProgress = updateInProgress;
        const submitDisabled =
          invalid ||
          disabled ||
          submitInProgress ||
          imageUploadRequested ||
          ready ||
          isOverImageLimit;

        const classes = classNames(css.root, className);

        return (
          <Form
            className={classes}
            onSubmit={e => {
              setSubmittedImages(images);
              handleSubmit(e);
            }}
          >
            {updateListingError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingPhotosForm.updateFailed" />
              </p>
            ) : null}

            <ListingImagesField
              form={form}
              images={props.initialValues?.images}
              onImageUpload={props.onImageUpload}
              onRemoveImage={onRemoveImage}
              listingImageConfig={listingImageConfig}
              maxImages={maxImages}
              onUploadStateChange={setImageUploadRequested}
            />

            <ImageUploadError
              uploadOverLimit={uploadOverLimit}
              uploadImageError={uploadImageError}
            />

            <p className={css.tip}>
              <FormattedMessage id="EditListingPhotosForm.addImagesTip" />
            </p>

            <div className={css.submitSection}>
              <PublishListingError error={publishListingError} />
              <ShowListingsError error={showListingsError} />

              {filesRequired && !allFilesUploadedAndVerified ? (
                <p className={css.filesNotReady}>
                  <FormattedMessage
                    id="EditListingPhotosForm.filesNotReady"
                    values={{
                      filesTabLink: (
                        <NamedLink name="EditListingPage" params={filesTabParams}>
                          <FormattedMessage id="EditListingPhotosForm.filesTabLinkText" />
                        </NamedLink>
                      ),
                    }}
                  />
                </p>
              ) : null}

              {isOverImageLimit ? (
                <p className={css.error}>
                  <FormattedMessage
                    id="EditListingPhotosForm.maxImagesExceeded"
                    values={{ maxImages }}
                  />
                </p>
              ) : null}

              <Button
                className={css.submitButton}
                type="submit"
                inProgress={submitInProgress}
                disabled={submitDisabled}
                ready={submitReady}
              >
                {saveActionMsg}
              </Button>
            </div>
          </Form>
        );
      }}
    />
  );
};

export default EditListingPhotosForm;
