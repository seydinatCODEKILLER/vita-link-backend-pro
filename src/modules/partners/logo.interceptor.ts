import { UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * fileFilter ne doit jamais passer une `Error` générique à `cb` : Multer
 * propage cette erreur en dehors du cycle de gestion d'exceptions standard
 * de NestJS (elle n'est pas interceptée par un ExceptionFilter), ce qui
 * produit une réponse brute incohérente avec le reste de l'API plutôt
 * qu'un vrai 415/400 JSON. On utilise UnsupportedMediaTypeException, que
 * NestJS sait correctement sérialiser, même appelée depuis ce contexte.
 */
export const logoInterceptor = FileInterceptor('logo', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
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
