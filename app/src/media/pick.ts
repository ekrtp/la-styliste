import * as ImagePicker from 'expo-image-picker';

/** Only this combination keeps PNG alpha and HEIC bytes (spec §6): no editing, full quality, the current representation. */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: false,
  quality: 1,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  base64: false,
  exif: false,
};

export type PhotoSource = 'camera' | 'library';

/** The person has not allowed the camera. */
export class PermissionDeniedError extends Error {
  constructor() {
    super('Camera permission denied');
    this.name = 'PermissionDeniedError';
  }
}

/** Opens the camera or the photo library; null when the person cancels. The library needs no permission on iOS 14+. */
export async function pickPhoto(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError();
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  return result.canceled ? null : result.assets[0];
}
