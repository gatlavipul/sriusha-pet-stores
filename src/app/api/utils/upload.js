/**
 * Sri Usha Vet & Pet Stores - Upload utility abstraction
 */
import { uploadImage } from "@/utils/storageService";

export async function upload({ file, url, buffer, base64 }) {
  if (file) {
    return await uploadImage(file);
  }
  // If remote URL is passed, return as is
  if (url) {
    return { url };
  }
  return { url: null };
}

export default upload;
