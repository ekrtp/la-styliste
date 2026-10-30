import type { ImagePickerAsset } from 'expo-image-picker';
import type { ItemPhotoKind, ItemTags } from '../../core/tags';
import type { Db } from '../../data/db';
import { createItemWithPhoto } from '../../data/items';
import { deletePhotoDir } from '../../media/photoFiles';
import { preparePhoto } from '../../media/pipeline';

/** Saves a new item: photo files first, then both rows in one transaction; if the rows fail, the files go too (spec §6). */
export async function addItem(db: Db, asset: ImagePickerAsset, kind: ItemPhotoKind, tags: ItemTags): Promise<string> {
  const photo = await preparePhoto(asset, kind);
  try {
    return await createItemWithPhoto(db, tags, photo);
  } catch (e) {
    deletePhotoDir(photo.id);
    throw e;
  }
}
