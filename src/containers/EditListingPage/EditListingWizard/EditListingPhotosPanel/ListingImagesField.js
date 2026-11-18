import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ARRAY_ERROR } from 'final-form';
import { Field, useFormState } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';
import isEqual from 'lodash/isEqual';
import classNames from 'classnames';
import loadable from '@loadable/component';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { nonEmptyArray, composeValidators } from '../../../../util/validators';
import { listingImageIdentifierStrings } from '../../EditListingPage.shared';

// Import shared components
import { AspectRatioWrapper } from '../../../../components';

// Import modules from this directory
import ListingImage from './ListingImage';
import css from './EditListingPhotosForm.module.css';

const ACCEPT_IMAGES = 'image/*';

// Split out of the main bundle - only fetched once this field actually mounts.
const Sortable = loadable.lib(() => import(/* webpackChunkName: "sortablejs" */ 'sortablejs'));

// Attaches SortableJS to the FieldArray's container and reorders the images
// FieldArray via moveImageRef.current() on drag end
const SortableController = props => {
  const {
    sortableModule,
    containerRef,
    moveImageRef,
    onDragStateChange,
    onChooseStateChange,
  } = props;
  const { default: SortableLib } = sortableModule;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const sortable = SortableLib.create(container, {
      animation: 150,
      delay: 150,
      forceFallback: true,
      handle: '[data-drag-handle]',
      ghostClass: css.sortableGhost,
      chosenClass: css.sortableChosen,
      dragClass: css.sortableDrag,
      delayOnTouchOnly: true,
      onChoose: () => onChooseStateChange(true),
      onUnchoose: () => onChooseStateChange(false),
      onStart: () => onDragStateChange(true),
      onEnd: event => {
        onDragStateChange(false);
        const { oldIndex, newIndex } = event;
        if (oldIndex !== newIndex) {
          moveImageRef.current(oldIndex, newIndex);
        }
      },
    });
    return () => {
      sortable.destroy();
    };
  }, [SortableLib, containerRef, moveImageRef, onDragStateChange, onChooseStateChange]);

  return null;
};

// Stable fallback so effects depending on `images` don't rerun on every render.
const NO_IMAGES = [];

const isImageFile = file => !!file?.type && file.type.startsWith('image/');

// Field component that uses file-input to allow user to select images.
// With `multiple`, several files can be picked at once.
export const FieldAddImage = props => {
  const {
    formApi,
    onImageUploadHandler,
    onFilesSelected,
    aspectWidth = 1,
    aspectHeight = 1,
    className,
    isChoosing,
    multiple = false,
    ...rest
  } = props;
  return (
    <Field form={null} {...rest}>
      {fieldprops => {
        const { accept, input, label, disabled: fieldDisabled } = fieldprops;
        const { name, type } = input;
        const onChange = e => {
          const files = Array.from(e.target.files || []);
          if (onFilesSelected) {
            onFilesSelected(files);
            // Allow selecting the same file again after it was removed.
            e.target.value = '';
          } else {
            const file = files[0];
            formApi.change(`addImage`, file);
            formApi.blur(`addImage`);
            onImageUploadHandler(file);
          }
        };
        const inputProps = { accept, id: name, name, onChange, type, multiple };
        return (
          <div className={classNames(css.addImageWrapper, className)}>
            <AspectRatioWrapper width={aspectWidth} height={aspectHeight}>
              {fieldDisabled ? null : <input {...inputProps} className={css.addImageInput} />}
              <label
                htmlFor={name}
                className={classNames(css.addImage, { [css.grabbingCursor]: isChoosing })}
              >
                {label}
              </label>
            </AspectRatioWrapper>
          </div>
        );
      }}
    </Field>
  );
};

// Wide drop zone: accepts files dropped from the desktop and opens the file picker on click.
const ImageDropzone = props => {
  const { name, disabled, isChoosing, isDragging, onFilesSelected, label } = props;
  const [isOver, setIsOver] = useState(false);

  const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes('Files');

  const handleDragOver = e => {
    if (!hasFiles(e) || disabled) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isOver) {
      setIsOver(true);
    }
  };
  const handleDragLeave = e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsOver(false);
    }
  };
  const handleDrop = e => {
    if (!hasFiles(e)) {
      return;
    }
    e.preventDefault();
    setIsOver(false);
    if (!disabled) {
      onFilesSelected(Array.from(e.dataTransfer.files || []));
    }
  };

  return (
    <div
      className={classNames(css.dropzone, {
        [css.dropzoneActive]: isOver,
        [css.dropzoneDisabled]: disabled,
        [css.addImageWrapperDragging]: isDragging,
      })}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={name}
        name={name}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        disabled={disabled}
        className={css.addImageInput}
        onChange={e => {
          onFilesSelected(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      <label
        htmlFor={name}
        className={classNames(css.dropzoneLabel, { [css.grabbingCursor]: isChoosing })}
      >
        {label}
      </label>
    </div>
  );
};

// Component that shows listing images from "images" field array
const FieldListingImage = props => {
  const {
    name,
    index,
    count,
    intl,
    onRemoveImage,
    onMoveImage,
    disableMoveUp,
    disableMoveDown,
    hideMoveControls,
    pendingFocusDirection,
    onFocusRequestHandled,
    isCoverImage,
    isChoosing,
    aspectWidth,
    aspectHeight,
    variantPrefix,
  } = props;

  const currentPositionMessage = intl.formatMessage(
    { id: 'ListingImage.screenreader.currentPosition' },
    { index: index + 1, count }
  );

  return (
    <Field name={name}>
      {fieldProps => {
        const { input } = fieldProps;
        const image = input.value;
        return image ? (
          <ListingImage
            image={image}
            key={image?.id?.uuid || image?.id}
            className={css.thumbnail}
            savedImageAltText={intl.formatMessage({
              id: 'EditListingPhotosForm.savedImageAltText',
            })}
            onRemoveImage={() => onRemoveImage(image?.id)}
            onMoveUp={() => onMoveImage(index, index - 1)}
            onMoveDown={() => onMoveImage(index, index + 1)}
            disableMoveUp={disableMoveUp}
            disableMoveDown={disableMoveDown}
            hideMoveControls={hideMoveControls}
            pendingFocusDirection={pendingFocusDirection}
            onFocusRequestHandled={onFocusRequestHandled}
            isCoverImage={isCoverImage}
            isChoosing={isChoosing}
            currentPositionMessage={currentPositionMessage}
            aspectWidth={aspectWidth}
            aspectHeight={aspectHeight}
            variantPrefix={variantPrefix}
          />
        ) : null;
      }}
    </Field>
  );
};

/**
 * Listing images field for any Final Form that has arrayMutators: uploads new photos,
 * keeps the "images" field array in sync with uploaded images, and lets users reorder
 * photos by dragging (or with the arrow controls) and remove them.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.form - Final Form API of the parent form
 * @param {Array} props.images - Renderable images (saved + uploaded) coming from the page state
 * @param {Function} props.onImageUpload - Uploads one image: ({ id, file }, listingImageConfig) => Promise
 * @param {Function} props.onRemoveImage - Called with the removed image id
 * @param {Object} props.listingImageConfig - aspectWidth, aspectHeight and variantPrefix
 * @param {number} [props.maxImages] - Max number of images for the listing type
 * @param {Function} [props.onUploadStateChange] - Called with true while uploads are in progress
 * @param {'tile'|'dropzone'} [props.variant] - 'tile' is the template's add-photo tile, 'dropzone'
 *   is a wide area that also accepts dragged files and multiple files at once
 * @param {ReactNode} [props.addImageLabel] - Content for the add-photo tile / drop zone
 * @returns {JSX.Element}
 */
const ListingImagesField = props => {
  const {
    form,
    images: propsImages = NO_IMAGES,
    onImageUpload,
    onRemoveImage,
    listingImageConfig,
    maxImages,
    onUploadStateChange,
    variant = 'tile',
    addImageLabel,
    className,
  } = props;
  const intl = useIntl();
  const { values, touched, errors } = useFormState({
    subscription: { values: true, touched: true, errors: true },
  });

  const [pendingUploads, setPendingUploads] = useState(0);
  const pendingUploadsRef = useRef(0);
  // Determines which image (by new index) and direction should get focus after an arrow move.
  const [focusRequest, setFocusRequest] = useState(null);
  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  const sortableContainerRef = useRef(null);
  // Always points at the latest move function, so the Sortable instance
  // (created once it mounts) never calls a stale closure.
  const moveImageRef = useRef(() => {});
  // Monitor dragging state to prevent pointer-events on add photo tile
  const [isDragging, setIsDragging] = useState(false);
  // Monitor choosing state to update pointer UI
  const [isChoosing, setIsChoosing] = useState(false);

  // keepDirtyOnReinitialize freezes images once dirty, so new uploads via
  // initialValues get dropped after a reorder/removal - push them in directly.
  useEffect(() => {
    if (!form || propsImages.length === 0) {
      return;
    }
    propsImages.forEach(image => {
      const currentImages = form.getState().values.images || [];
      const ids = listingImageIdentifierStrings(image);
      // Find index of this image in the form's current images if it exists
      const index = currentImages.findIndex(existing =>
        listingImageIdentifierStrings(existing).some(id => ids.includes(id))
      );
      if (index === -1) {
        // New upload, not in the form yet
        form.mutators.push('images', image);
      } else if (!isEqual(currentImages[index], image)) {
        // Already in the form, but stale (e.g. upload just finished)
        form.mutators.update('images', index, image);
      }
    });
  }, [form, propsImages]);

  const images = values.images || [];
  const { aspectWidth = 1, aspectHeight = 1, variantPrefix } = listingImageConfig;
  const hasImageLimit = typeof maxImages === 'number';
  const isAtOrOverImageLimit = hasImageLimit && images.length >= maxImages;

  // Tracks uploads in progress and tells the parent form when uploading starts or stops.
  const changePendingUploads = delta => {
    const wasUploading = pendingUploadsRef.current > 0;
    pendingUploadsRef.current += delta;
    setPendingUploads(pendingUploadsRef.current);
    const isUploading = pendingUploadsRef.current > 0;
    if (onUploadStateChange && wasUploading !== isUploading) {
      onUploadStateChange(isUploading);
    }
  };

  const uploadFile = file => {
    changePendingUploads(1);
    return onImageUpload({ id: `${file.name}_${Date.now()}`, file }, listingImageConfig)
      .catch(() => {
        // Upload errors are shown from the page state (uploadImageError)
      })
      .finally(() => {
        changePendingUploads(-1);
      });
  };

  // Uploads as many of the given files as the image limit still allows.
  const handleFilesSelected = files => {
    const imageFiles = files.filter(isImageFile);
    const currentCount = (form.getState().values.images || []).length + pendingUploads;
    const freeSlots = hasImageLimit ? Math.max(maxImages - currentCount, 0) : imageFiles.length;
    imageFiles.slice(0, freeSlots).forEach(uploadFile);
  };

  // Single file upload from the template's add-photo tile.
  const onImageUploadHandler = file => {
    const currentImages = form.getState().values.images || [];
    if (hasImageLimit && currentImages.length >= maxImages) {
      return;
    }
    if (file) {
      uploadFile(file);
    }
  };

  const imagesError = touched.images && errors?.images && errors.images[ARRAY_ERROR];
  const uploadInProgress = pendingUploads > 0;
  const isDropzone = variant === 'dropzone';

  const defaultLabel = (
    <span className={css.chooseImageText}>
      <span className={css.chooseImage}>
        <FormattedMessage id="EditListingPhotosForm.chooseImage" />
      </span>
      <span className={css.imageTypes}>
        <FormattedMessage id="EditListingPhotosForm.imageTypes" />
      </span>
    </span>
  );

  const addImage = isAtOrOverImageLimit ? null : isDropzone ? (
    <ImageDropzone
      name="addImage"
      disabled={hasImageLimit && images.length + pendingUploads >= maxImages}
      isChoosing={isChoosing}
      isDragging={isDragging}
      onFilesSelected={handleFilesSelected}
      label={addImageLabel || defaultLabel}
    />
  ) : (
    <FieldAddImage
      id="addImage"
      name="addImage"
      accept={ACCEPT_IMAGES}
      className={isDragging ? css.addImageWrapperDragging : null}
      isChoosing={isChoosing}
      label={addImageLabel || defaultLabel}
      type="file"
      disabled={uploadInProgress}
      formApi={form}
      onImageUploadHandler={onImageUploadHandler}
      aspectWidth={aspectWidth}
      aspectHeight={aspectHeight}
    />
  );

  // Without a className, render no wrapper so the template's Photos form DOM stays unchanged.
  const Wrapper = className ? 'div' : React.Fragment;
  const wrapperProps = className ? { className } : {};

  return (
    <Wrapper {...wrapperProps}>
      {isDropzone ? addImage : null}

      <div
        className={classNames(isDropzone ? css.imagesGrid : css.imagesFieldArray, {
          [css.grabbingCursor]: isChoosing,
          [css.imagesGridEmpty]: isDropzone && images.length === 0,
        })}
      >
        <FieldArray
          name="images"
          validate={composeValidators(
            nonEmptyArray(
              intl.formatMessage({
                id: 'EditListingPhotosForm.imageRequired',
              })
            )
          )}
        >
          {({ fields }) => {
            // Bounds-checked move, shared by both arrows and Sortable's drag.
            const moveImage = (fromIndex, toIndex) => {
              if (toIndex < 0 || toIndex >= fields.length) {
                return false;
              }
              fields.move(fromIndex, toIndex);
              return true;
            };
            moveImageRef.current = moveImage;

            return (
              <div className={css.sortableImages} ref={sortableContainerRef}>
                {fields.map((name, index) => (
                  <FieldListingImage
                    key={name}
                    name={name}
                    index={index}
                    count={fields.length}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === fields.length - 1}
                    hideMoveControls={fields.length === 1}
                    isCoverImage={index === 0}
                    isChoosing={isChoosing}
                    onRemoveImage={imageId => {
                      fields.remove(index);
                      onRemoveImage(imageId);
                    }}
                    onMoveImage={(fromIndex, toIndex) => {
                      // Only arrows request focus-follow; drag skips this.
                      if (moveImage(fromIndex, toIndex)) {
                        setFocusRequest({
                          index: toIndex,
                          direction: toIndex < fromIndex ? 'up' : 'down',
                        });
                      }
                    }}
                    pendingFocusDirection={
                      focusRequest?.index === index ? focusRequest.direction : null
                    }
                    onFocusRequestHandled={clearFocusRequest}
                    intl={intl}
                    aspectWidth={aspectWidth}
                    aspectHeight={aspectHeight}
                    variantPrefix={variantPrefix}
                  />
                ))}
              </div>
            );
          }}
        </FieldArray>

        {images.length > 1 ? (
          <Sortable>
            {sortableModule => (
              <SortableController
                sortableModule={sortableModule}
                containerRef={sortableContainerRef}
                moveImageRef={moveImageRef}
                onDragStateChange={setIsDragging}
                onChooseStateChange={setIsChoosing}
              />
            )}
          </Sortable>
        ) : null}

        {isDropzone ? null : addImage}
      </div>

      {imagesError ? <div className={css.arrayError}>{imagesError}</div> : null}
    </Wrapper>
  );
};

export default ListingImagesField;
