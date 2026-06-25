import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import 'multer';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  upload(
    file: Express.Multer.File,
    folder = 'vita-link/avatars',
    prefix = 'avatar',
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${prefix}_${Date.now()}`,
          resource_type: 'auto',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(
              new Error(error?.message ?? 'Cloudinary upload failed'),
            );
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }

  uploadBuffer(
    buffer: Buffer,
    folder = 'vita-link/qrcodes',
    prefix = 'qr',
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${prefix}_${Date.now()}`,
          resource_type: 'image',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(
              new Error(error?.message ?? 'Cloudinary upload failed'),
            );
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      this.logger.log(`Media deleted — ${publicId}`);
    } catch (err) {
      this.logger.error(`Delete by publicId failed — ${publicId}`, err);
    }
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
      const publicId = publicIdWithExtension.substring(
        0,
        publicIdWithExtension.lastIndexOf('.'),
      );
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        this.logger.log(`Media deleted by URL — ${publicId}`);
      }
    } catch (err) {
      this.logger.error('Delete by URL failed', err);
    }
  }
}
