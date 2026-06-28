import { UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const DEFAULT_ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export interface ImageUploadInterceptorOptions {
  /** Nom du champ multipart/form-data contenant le fichier (ex: 'logo', 'avatar') */
  fieldName: string;
  /** Taille maximale en octets. Défaut : 5 Mo. */
  maxSizeBytes?: number;
  /** Types MIME autorisés. Défaut : JPEG, PNG, WEBP. */
  allowedMimeTypes?: string[];
}

/**
 * Fabrique un interceptor d'upload d'image réutilisable à travers les
 * modules (Partners, Users, ou tout autre module ayant besoin d'un upload
 * d'image simple vers Cloudinary). Centralise la config (stockage mémoire,
 * limite de taille, filtre MIME) et la gestion d'erreur correcte :
 * fileFilter ne doit jamais passer une `Error` générique à `cb`, car Multer
 * propage cette erreur en dehors du cycle de gestion d'exceptions standard
 * de NestJS — UnsupportedMediaTypeException est correctement sérialisée,
 * elle.
 */
export function createImageUploadInterceptor(
  options: ImageUploadInterceptorOptions,
) {
  const {
    fieldName,
    maxSizeBytes = 5 * 1024 * 1024,
    allowedMimeTypes = DEFAULT_ALLOWED_IMAGE_MIME_TYPES,
  } = options;

  return FileInterceptor(fieldName, {
    storage: memoryStorage(),
    limits: { fileSize: maxSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(
        new UnsupportedMediaTypeException(
          'Format non supporté. Utilisez JPEG, PNG ou WEBP.',
        ),
        false,
      );
    },
  });
}
