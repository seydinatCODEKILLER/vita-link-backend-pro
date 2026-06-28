import { createImageUploadInterceptor } from '@/common/interceptors/image-upload.interceptor';

export const avatarInterceptor = createImageUploadInterceptor({
  fieldName: 'avatar',
});
