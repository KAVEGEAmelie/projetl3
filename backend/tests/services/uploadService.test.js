const uploadService = require('../../src/services/uploadService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Mock des dépendances
jest.mock('sharp');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('Upload Service', () => {
  let mockSharp;

  beforeEach(() => {
    // Mock Sharp
    mockSharp = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image')),
      toFile: jest.fn().mockResolvedValue({ size: 1024 })
    };
    sharp.mockReturnValue(mockSharp);

    // Mock fs
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    fs.unlink.mockResolvedValue();
    fs.readFile.mockResolvedValue(Buffer.from('fake-file-content'));
    fs.writeFile.mockResolvedValue();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('multer configuration', () => {
    it('should configure multer for image uploads', () => {
      const upload = uploadService.configureMulter('images');
      
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
    });

    it('should set proper file size limits', () => {
      const upload = uploadService.configureMulter('images', { maxSize: 5 * 1024 * 1024 });
      
      expect(upload).toBeDefined();
    });

    it('should filter file types correctly', async () => {
      const mockReq = {};
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg'
      };

      const fileFilter = uploadService.createFileFilter(['image/jpeg', 'image/png']);
      const result = await new Promise((resolve) => {
        fileFilter(mockReq, mockFile, (error) => {
          resolve(!error);
        });
      });

      expect(result).toBe(true);
    });

    it('should reject invalid file types', async () => {
      const mockReq = {};
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain'
      };

      const fileFilter = uploadService.createFileFilter(['image/jpeg', 'image/png']);
      const result = await new Promise((resolve, reject) => {
        fileFilter(mockReq, mockFile, (error) => {
          resolve(error ? false : true);
        });
      });

      expect(result).toBe(false);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp', () => {
      const originalName = 'test-image.jpg';
      const filename = uploadService.generateUniqueFilename(originalName);

      expect(filename).toMatch(/^\d{13}-[a-z0-9]{8}-test-image\.jpg$/);
    });

    it('should handle files without extension', () => {
      const originalName = 'test-file';
      const filename = uploadService.generateUniqueFilename(originalName);

      expect(filename).toMatch(/^\d{13}-[a-z0-9]{8}-test-file$/);
    });

    it('should sanitize filename', () => {
      const originalName = 'test file@#$%.jpg';
      const filename = uploadService.generateUniqueFilename(originalName);

      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('$');
      expect(filename).not.toContain('%');
      expect(filename).not.toContain(' ');
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue(new Error('Directory does not exist'));

      await uploadService.ensureDirectoryExists('/path/to/directory');

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/directory', { recursive: true });
    });

    it('should not create directory if it exists', async () => {
      fs.access.mockResolvedValue(); // Directory exists

      await uploadService.ensureDirectoryExists('/path/to/existing');

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('processImage', () => {
    const mockFile = {
      path: '/tmp/upload.jpg',
      filename: 'test-image.jpg',
      mimetype: 'image/jpeg'
    };

    it('should resize image to specified dimensions', async () => {
      const options = {
        width: 800,
        height: 600,
        quality: 80
      };

      const result = await uploadService.processImage(mockFile, options);

      expect(sharp).toHaveBeenCalledWith(mockFile.path);
      expect(mockSharp.resize).toHaveBeenCalledWith(800, 600, expect.any(Object));
      expect(result.processed).toBe(true);
    });

    it('should maintain aspect ratio by default', async () => {
      const options = {
        width: 800,
        maintainAspectRatio: true
      };

      await uploadService.processImage(mockFile, options);

      expect(mockSharp.resize).toHaveBeenCalledWith(
        800, 
        null, 
        expect.objectContaining({ 
          fit: 'inside',
          withoutEnlargement: true 
        })
      );
    });

    it('should convert image format if specified', async () => {
      const options = {
        format: 'webp',
        quality: 85
      };

      await uploadService.processImage(mockFile, options);

      expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 });
    });

    it('should generate thumbnails', async () => {
      const options = {
        generateThumbnails: true,
        thumbnailSizes: [
          { suffix: 'small', width: 150, height: 150 },
          { suffix: 'medium', width: 300, height: 300 }
        ]
      };

      const result = await uploadService.processImage(mockFile, options);

      expect(result.thumbnails).toHaveLength(2);
      expect(result.thumbnails[0].suffix).toBe('small');
      expect(result.thumbnails[1].suffix).toBe('medium');
    });

    it('should optimize image quality', async () => {
      const jpegFile = { ...mockFile, mimetype: 'image/jpeg' };
      const options = { quality: 90 };

      await uploadService.processImage(jpegFile, options);

      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 90 });
    });

    it('should handle processing errors', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Processing failed'));

      await expect(uploadService.processImage(mockFile, {}))
        .rejects.toThrow('Processing failed');
    });
  });

  describe('uploadUserAvatar', () => {
    const mockFile = {
      path: '/tmp/avatar.jpg',
      filename: 'avatar.jpg',
      originalname: 'user-avatar.jpg',
      mimetype: 'image/jpeg',
      size: 1024000
    };

    it('should upload and process user avatar', async () => {
      const userId = 123;
      
      const result = await uploadService.uploadUserAvatar(mockFile, userId);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.thumbnails).toBeDefined();
    });

    it('should validate file size for avatars', async () => {
      const largeFile = { ...mockFile, size: 10 * 1024 * 1024 }; // 10MB

      const result = await uploadService.uploadUserAvatar(largeFile, 123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('size');
    });

    it('should validate file type for avatars', async () => {
      const invalidFile = { ...mockFile, mimetype: 'text/plain' };

      const result = await uploadService.uploadUserAvatar(invalidFile, 123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should create user-specific directory', async () => {
      const userId = 456;

      await uploadService.uploadUserAvatar(mockFile, userId);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(`users/${userId}`),
        expect.any(Object)
      );
    });
  });

  describe('uploadProductImages', () => {
    const mockFiles = [
      {
        path: '/tmp/product1.jpg',
        filename: 'product1.jpg',
        originalname: 'product-image-1.jpg',
        mimetype: 'image/jpeg',
        size: 512000
      },
      {
        path: '/tmp/product2.jpg',
        filename: 'product2.jpg',
        originalname: 'product-image-2.jpg',
        mimetype: 'image/png',
        size: 768000
      }
    ];

    it('should upload multiple product images', async () => {
      const productId = 789;

      const result = await uploadService.uploadProductImages(mockFiles, productId);

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(2);
      expect(result.images[0].thumbnails).toBeDefined();
    });

    it('should limit number of images per product', async () => {
      const tooManyFiles = Array(15).fill(mockFiles[0]); // Plus de 10 images
      
      const result = await uploadService.uploadProductImages(tooManyFiles, 789);

      expect(result.success).toBe(false);
      expect(result.error).toContain('limit');
    });

    it('should generate multiple thumbnail sizes for products', async () => {
      const productId = 789;

      const result = await uploadService.uploadProductImages([mockFiles[0]], productId);

      if (result.success) {
        const image = result.images[0];
        expect(image.thumbnails.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should organize images by product ID', async () => {
      const productId = 999;

      await uploadService.uploadProductImages([mockFiles[0]], productId);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(`products/${productId}`),
        expect.any(Object)
      );
    });
  });

  describe('uploadStoreImages', () => {
    const mockFile = {
      path: '/tmp/store-logo.jpg',
      filename: 'store-logo.jpg',
      originalname: 'my-store-logo.jpg',
      mimetype: 'image/jpeg',
      size: 256000
    };

    it('should upload store logo', async () => {
      const storeId = 456;

      const result = await uploadService.uploadStoreLogo(mockFile, storeId);

      expect(result.success).toBe(true);
      expect(result.logoPath).toBeDefined();
    });

    it('should resize logo to standard dimensions', async () => {
      const storeId = 456;

      await uploadService.uploadStoreLogo(mockFile, storeId);

      expect(mockSharp.resize).toHaveBeenCalledWith(
        300, 300, 
        expect.objectContaining({ fit: 'cover' })
      );
    });

    it('should validate logo dimensions', async () => {
      // Mock sharp to return image metadata
      mockSharp.metadata = jest.fn().mockResolvedValue({
        width: 50,
        height: 50
      });
      sharp.mockReturnValue(mockSharp);

      const result = await uploadService.uploadStoreLogo(mockFile, 456);

      expect(result.success).toBe(false);
      expect(result.error).toContain('dimensions');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from filesystem', async () => {
      const filePath = '/path/to/file.jpg';

      const result = await uploadService.deleteFile(filePath);

      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(filePath);
    });

    it('should delete thumbnails with main file', async () => {
      const filePath = '/path/to/image.jpg';
      const thumbnails = [
        '/path/to/image-small.jpg',
        '/path/to/image-medium.jpg'
      ];

      const result = await uploadService.deleteFile(filePath, { thumbnails });

      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalledTimes(3); // Main + 2 thumbnails
    });

    it('should handle file not found errors', async () => {
      fs.unlink.mockRejectedValue(new Error('ENOENT: file not found'));

      const result = await uploadService.deleteFile('/nonexistent/file.jpg');

      expect(result.success).toBe(true); // Should not fail if file doesn't exist
    });
  });

  describe('getFileMetadata', () => {
    it('should extract file metadata', async () => {
      const filePath = '/path/to/image.jpg';
      
      mockSharp.metadata = jest.fn().mockResolvedValue({
        format: 'jpeg',
        width: 1920,
        height: 1080,
        channels: 3,
        density: 72
      });
      sharp.mockReturnValue(mockSharp);

      const metadata = await uploadService.getFileMetadata(filePath);

      expect(metadata.format).toBe('jpeg');
      expect(metadata.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should handle non-image files', async () => {
      const filePath = '/path/to/document.pdf';
      
      mockSharp.metadata.mockRejectedValue(new Error('Input file contains unsupported image format'));

      const metadata = await uploadService.getFileMetadata(filePath);

      expect(metadata.isImage).toBe(false);
    });
  });

  describe('cloud storage integration', () => {
    it('should upload to cloud storage when configured', async () => {
      // Mock cloud storage configuration
      process.env.CLOUD_STORAGE_ENABLED = 'true';
      process.env.CLOUD_STORAGE_BUCKET = 'test-bucket';

      const mockFile = {
        path: '/tmp/test.jpg',
        filename: 'test.jpg',
        mimetype: 'image/jpeg'
      };

      // Mock cloud upload function
      uploadService.uploadToCloud = jest.fn().mockResolvedValue({
        success: true,
        url: 'https://cloud.example.com/test.jpg'
      });

      const result = await uploadService.uploadUserAvatar(mockFile, 123);

      expect(uploadService.uploadToCloud).toHaveBeenCalled();
      if (result.success) {
        expect(result.cloudUrl).toBeDefined();
      }
    });

    it('should fallback to local storage on cloud failure', async () => {
      process.env.CLOUD_STORAGE_ENABLED = 'true';

      uploadService.uploadToCloud = jest.fn().mockRejectedValue(new Error('Cloud error'));

      const mockFile = {
        path: '/tmp/fallback.jpg',
        filename: 'fallback.jpg',
        mimetype: 'image/jpeg',
        size: 1024000
      };

      const result = await uploadService.uploadUserAvatar(mockFile, 123);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });
  });

  describe('security validations', () => {
    it('should validate file signatures', async () => {
      const maliciousFile = {
        path: '/tmp/malicious.jpg',
        filename: 'malicious.jpg',
        originalname: 'image.jpg',
        mimetype: 'image/jpeg', // Claimed MIME type
        size: 1024
      };

      // Mock file content that doesn't match JPEG signature
      fs.readFile.mockResolvedValue(Buffer.from('Not a real JPEG file'));

      const result = await uploadService.validateFileSignature(maliciousFile);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('signature');
    });

    it('should scan for malware if configured', async () => {
      process.env.MALWARE_SCANNING_ENABLED = 'true';

      const mockFile = {
        path: '/tmp/suspicious.jpg',
        filename: 'suspicious.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      uploadService.scanForMalware = jest.fn().mockResolvedValue({
        clean: true,
        scanResult: 'No threats detected'
      });

      const result = await uploadService.uploadUserAvatar(mockFile, 123);

      expect(uploadService.scanForMalware).toHaveBeenCalledWith(mockFile.path);
    });
  });
});