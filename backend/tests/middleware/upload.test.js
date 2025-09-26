const uploadMiddleware = require('../../src/middleware/upload');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Mock des dépendances
jest.mock('multer');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn()
  }
}));

jest.mock('sharp', () => jest.fn(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue({ size: 50000 }),
  metadata: jest.fn().mockResolvedValue({
    width: 800,
    height: 600,
    format: 'jpeg'
  })
})));

describe('Upload Middleware', () => {
  let req, res, next;
  let mockMulter;

  beforeEach(() => {
    req = {
      user: { id: 1, role: 'vendor' },
      file: null,
      files: null,
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Mock multer
    mockMulter = {
      single: jest.fn(),
      array: jest.fn(),
      fields: jest.fn()
    };

    multer.mockReturnValue(mockMulter);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('File Type Validation', () => {
    it('should allow valid image types', () => {
      const fileFilter = uploadMiddleware.imageFileFilter;

      const validFiles = [
        { mimetype: 'image/jpeg', originalname: 'test.jpg' },
        { mimetype: 'image/png', originalname: 'test.png' },
        { mimetype: 'image/gif', originalname: 'test.gif' },
        { mimetype: 'image/webp', originalname: 'test.webp' }
      ];

      validFiles.forEach(file => {
        const cb = jest.fn();
        fileFilter(req, file, cb);
        expect(cb).toHaveBeenCalledWith(null, true);
      });
    });

    it('should reject invalid file types', () => {
      const fileFilter = uploadMiddleware.imageFileFilter;

      const invalidFiles = [
        { mimetype: 'text/plain', originalname: 'test.txt' },
        { mimetype: 'application/pdf', originalname: 'test.pdf' },
        { mimetype: 'video/mp4', originalname: 'test.mp4' },
        { mimetype: 'application/javascript', originalname: 'malicious.js' }
      ];

      invalidFiles.forEach(file => {
        const cb = jest.fn();
        fileFilter(req, file, cb);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'MulterError',
            code: 'INVALID_FILE_TYPE'
          }),
          false
        );
      });
    });

    it('should validate file extensions', () => {
      const fileFilter = uploadMiddleware.imageFileFilter;

      const suspiciousFiles = [
        { mimetype: 'image/jpeg', originalname: 'test.jpg.exe' },
        { mimetype: 'image/png', originalname: 'script.php.png' },
        { mimetype: 'image/gif', originalname: 'test.gif.js' }
      ];

      suspiciousFiles.forEach(file => {
        const cb = jest.fn();
        fileFilter(req, file, cb);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'MulterError',
            code: 'INVALID_FILE_TYPE'
          }),
          false
        );
      });
    });
  });

  describe('File Size Validation', () => {
    it('should enforce file size limits', () => {
      const config = uploadMiddleware.getUploadConfig('avatar');

      expect(config.limits.fileSize).toBe(2 * 1024 * 1024); // 2MB for avatars
    });

    it('should have different limits for different upload types', () => {
      const avatarConfig = uploadMiddleware.getUploadConfig('avatar');
      const productConfig = uploadMiddleware.getUploadConfig('product');
      const documentConfig = uploadMiddleware.getUploadConfig('document');

      expect(avatarConfig.limits.fileSize).toBe(2 * 1024 * 1024); // 2MB
      expect(productConfig.limits.fileSize).toBe(5 * 1024 * 1024); // 5MB
      expect(documentConfig.limits.fileSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should limit number of files', () => {
      const singleConfig = uploadMiddleware.getUploadConfig('avatar');
      const multipleConfig = uploadMiddleware.getUploadConfig('product');

      expect(singleConfig.limits.files).toBe(1);
      expect(multipleConfig.limits.files).toBe(5);
    });
  });

  describe('Storage Configuration', () => {
    it('should generate unique filenames', () => {
      const storage = uploadMiddleware.createStorage('products');
      const filename = storage.filename(req, {
        originalname: 'test image.jpg'
      }, () => {});

      expect(filename).toMatch(/^\d+_[a-f0-9]{8}_test_image\.jpg$/);
    });

    it('should organize files by date and user', () => {
      req.user = { id: 123 };
      
      const storage = uploadMiddleware.createStorage('products');
      const destination = storage.destination(req, {}, () => {});

      const today = new Date();
      const expectedPath = path.join(
        'uploads',
        'products',
        today.getFullYear().toString(),
        (today.getMonth() + 1).toString().padStart(2, '0'),
        '123'
      );

      expect(destination).toBe(expectedPath);
    });

    it('should create directories if they do not exist', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      fs.mkdir.mockResolvedValue();

      const storage = uploadMiddleware.createStorage('avatars');
      
      const cb = jest.fn();
      await storage.destination(req, {}, cb);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
      expect(cb).toHaveBeenCalledWith(null, expect.any(String));
    });

    it('should handle directory creation errors', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const storage = uploadMiddleware.createStorage('avatars');
      
      const cb = jest.fn();
      await storage.destination(req, {}, cb);

      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Image Processing', () => {
    it('should resize images to specified dimensions', async () => {
      const file = {
        path: '/tmp/upload.jpg',
        filename: 'test.jpg'
      };

      const mockSharp = require('sharp')();
      
      await uploadMiddleware.resizeImage(file, {
        width: 300,
        height: 300,
        quality: 80
      });

      expect(mockSharp.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center'
      });
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should create thumbnails for product images', async () => {
      const file = {
        path: '/uploads/products/test.jpg',
        filename: 'test.jpg'
      };

      const mockSharp = require('sharp')();

      await uploadMiddleware.createThumbnails(file);

      // Should create small, medium, and large thumbnails
      expect(mockSharp.resize).toHaveBeenCalledTimes(3);
      expect(mockSharp.toFile).toHaveBeenCalledTimes(3);
    });

    it('should optimize images for web', async () => {
      const file = {
        path: '/uploads/test.jpg',
        filename: 'test.jpg',
        mimetype: 'image/jpeg'
      };

      const mockSharp = require('sharp')();

      await uploadMiddleware.optimizeForWeb(file);

      expect(mockSharp.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true
      });
    });

    it('should convert to WebP format when supported', async () => {
      req.headers.accept = 'image/webp,image/*';
      
      const file = {
        path: '/uploads/test.jpg',
        filename: 'test.jpg'
      };

      const mockSharp = require('sharp')();

      await uploadMiddleware.convertToWebP(file, req);

      expect(mockSharp.webp).toHaveBeenCalledWith({
        quality: 80,
        effort: 6
      });
    });
  });

  describe('Security Validation', () => {
    it('should scan for malicious content', async () => {
      const file = {
        path: '/tmp/upload.jpg',
        buffer: Buffer.from('fake-image-data')
      };

      // Mock virus scan
      uploadMiddleware.virusScanner = {
        scan: jest.fn().mockResolvedValue({ isInfected: false })
      };

      const result = await uploadMiddleware.scanForMalware(file);

      expect(uploadMiddleware.virusScanner.scan).toHaveBeenCalledWith(file.path);
      expect(result.isSafe).toBe(true);
    });

    it('should reject infected files', async () => {
      const file = {
        path: '/tmp/infected.jpg',
        buffer: Buffer.from('malicious-data')
      };

      uploadMiddleware.virusScanner = {
        scan: jest.fn().mockResolvedValue({
          isInfected: true,
          viruses: ['Trojan.Generic']
        })
      };

      await expect(uploadMiddleware.scanForMalware(file))
        .rejects.toThrow('Malicious content detected');
    });

    it('should validate image metadata', async () => {
      const file = {
        path: '/uploads/test.jpg'
      };

      const mockSharp = require('sharp')();
      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        channels: 3,
        density: 72
      });

      const metadata = await uploadMiddleware.validateImageMetadata(file);

      expect(metadata).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        isValid: true
      });
    });

    it('should reject corrupted images', async () => {
      const file = {
        path: '/uploads/corrupted.jpg'
      };

      const mockSharp = require('sharp')();
      mockSharp.metadata.mockRejectedValue(new Error('Input buffer contains unsupported image format'));

      await expect(uploadMiddleware.validateImageMetadata(file))
        .rejects.toThrow('Invalid or corrupted image');
    });
  });

  describe('Upload Handlers', () => {
    it('should handle single file upload', async () => {
      req.file = {
        fieldname: 'avatar',
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
        size: 150000,
        path: '/uploads/avatar/123_profile.jpg',
        filename: '123_profile.jpg'
      };

      await uploadMiddleware.handleSingleUpload('avatar')(req, res, next);

      expect(req.uploadResult).toEqual({
        file: req.file,
        url: expect.stringContaining('123_profile.jpg')
      });
      expect(next).toHaveBeenCalled();
    });

    it('should handle multiple file upload', async () => {
      req.files = [
        {
          fieldname: 'images',
          originalname: 'image1.jpg',
          mimetype: 'image/jpeg',
          size: 200000,
          path: '/uploads/products/image1.jpg',
          filename: 'image1.jpg'
        },
        {
          fieldname: 'images',
          originalname: 'image2.jpg',
          mimetype: 'image/jpeg',
          size: 180000,
          path: '/uploads/products/image2.jpg',
          filename: 'image2.jpg'
        }
      ];

      await uploadMiddleware.handleMultipleUpload('images', 5)(req, res, next);

      expect(req.uploadResult).toEqual({
        files: req.files,
        urls: expect.arrayContaining([
          expect.stringContaining('image1.jpg'),
          expect.stringContaining('image2.jpg')
        ])
      });
    });

    it('should cleanup failed uploads', async () => {
      req.file = {
        path: '/uploads/failed.jpg',
        filename: 'failed.jpg'
      };

      // Simulate processing error
      uploadMiddleware.processUpload = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await uploadMiddleware.handleSingleUpload('avatar')(req, res, next);

      expect(fs.unlink).toHaveBeenCalledWith('/uploads/failed.jpg');
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('File Management', () => {
    it('should delete old files when updating', async () => {
      req.user = { id: 1, avatar: '/uploads/old-avatar.jpg' };
      req.file = {
        path: '/uploads/new-avatar.jpg',
        filename: 'new-avatar.jpg'
      };

      fs.stat.mockResolvedValue({ size: 50000 });
      fs.unlink.mockResolvedValue();

      await uploadMiddleware.replaceFile('avatar')(req, res, next);

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads/old-avatar.jpg')
      );
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing old files gracefully', async () => {
      req.user = { id: 1, avatar: '/uploads/missing.jpg' };
      req.file = {
        path: '/uploads/new-avatar.jpg',
        filename: 'new-avatar.jpg'
      };

      fs.unlink.mockRejectedValue(new Error('ENOENT: no such file'));

      await uploadMiddleware.replaceFile('avatar')(req, res, next);

      // Should continue despite missing old file
      expect(next).toHaveBeenCalled();
    });

    it('should validate file ownership before deletion', async () => {
      req.user = { id: 2 };
      req.params = { fileId: 'file123' };

      const mockFile = {
        id: 'file123',
        ownerId: 1, // Different user
        path: '/uploads/protected.jpg'
      };

      uploadMiddleware.getFileById = jest.fn().mockResolvedValue(mockFile);

      await uploadMiddleware.deleteFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authorized to delete this file'
      });
    });
  });

  describe('Quota Management', () => {
    it('should enforce storage quotas', async () => {
      req.user = { id: 1, storageUsed: 95 * 1024 * 1024 }; // 95MB used
      req.file = {
        size: 10 * 1024 * 1024 // 10MB file
      };

      const quota = 100 * 1024 * 1024; // 100MB limit

      await uploadMiddleware.checkQuota(quota)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Storage quota exceeded',
        quotaUsed: 95 * 1024 * 1024,
        quotaLimit: quota
      });
    });

    it('should allow upload within quota', async () => {
      req.user = { id: 1, storageUsed: 50 * 1024 * 1024 }; // 50MB used
      req.file = {
        size: 5 * 1024 * 1024 // 5MB file
      };

      const quota = 100 * 1024 * 1024; // 100MB limit

      await uploadMiddleware.checkQuota(quota)(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should update storage usage after successful upload', async () => {
      req.user = { id: 1, storageUsed: 50 * 1024 * 1024 };
      req.file = { size: 2 * 1024 * 1024 };

      uploadMiddleware.updateStorageUsage = jest.fn().mockResolvedValue(true);

      await uploadMiddleware.trackStorageUsage(req, res, next);

      expect(uploadMiddleware.updateStorageUsage).toHaveBeenCalledWith(
        1,
        52 * 1024 * 1024
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle multer errors', () => {
      const error = new multer.MulterError('LIMIT_FILE_SIZE');
      error.code = 'LIMIT_FILE_SIZE';

      uploadMiddleware.handleUploadError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File size exceeds limit'
      });
    });

    it('should handle unexpected file count', () => {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      error.field = 'images';

      uploadMiddleware.handleUploadError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unexpected field: images'
      });
    });

    it('should handle processing errors', async () => {
      req.file = {
        path: '/uploads/test.jpg'
      };

      const error = new Error('Image processing failed');

      uploadMiddleware.processImage = jest.fn().mockRejectedValue(error);

      await uploadMiddleware.handleImageProcessing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Image processing failed'
      });

      // Should cleanup failed file
      expect(fs.unlink).toHaveBeenCalledWith('/uploads/test.jpg');
    });
  });

  describe('Cloud Storage Integration', () => {
    it('should upload to cloud storage when configured', async () => {
      process.env.CLOUD_STORAGE_ENABLED = 'true';
      
      req.file = {
        path: '/uploads/local/test.jpg',
        filename: 'test.jpg',
        mimetype: 'image/jpeg'
      };

      const mockCloudStorage = {
        upload: jest.fn().mockResolvedValue({
          url: 'https://cloud.example.com/test.jpg',
          publicId: 'uploads/test'
        })
      };

      uploadMiddleware.cloudStorage = mockCloudStorage;

      await uploadMiddleware.handleCloudUpload(req, res, next);

      expect(mockCloudStorage.upload).toHaveBeenCalledWith(
        '/uploads/local/test.jpg',
        {
          folder: 'uploads',
          resource_type: 'image',
          public_id: expect.any(String)
        }
      );

      expect(req.cloudResult).toEqual({
        url: 'https://cloud.example.com/test.jpg',
        publicId: 'uploads/test'
      });
    });

    it('should fallback to local storage on cloud failure', async () => {
      process.env.CLOUD_STORAGE_ENABLED = 'true';
      
      req.file = {
        path: '/uploads/local/test.jpg',
        filename: 'test.jpg'
      };

      const mockCloudStorage = {
        upload: jest.fn().mockRejectedValue(new Error('Cloud upload failed'))
      };

      uploadMiddleware.cloudStorage = mockCloudStorage;

      await uploadMiddleware.handleCloudUpload(req, res, next);

      // Should continue with local file
      expect(next).toHaveBeenCalled();
      expect(req.cloudResult).toBeUndefined();
    });
  });
});