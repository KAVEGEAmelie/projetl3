const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

/**
 * Configuration des types de fichiers autorisés
 */
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

/**
 * Configuration de stockage local
 */
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/temp/';
    
    // Déterminer le dossier selon le type de fichier
    if (file.fieldname === 'avatar') {
      uploadPath = 'uploads/users/';
    } else if (file.fieldname === 'logo' || file.fieldname === 'banner') {
      uploadPath = 'uploads/stores/';
    } else if (file.fieldname === 'product_images') {
      uploadPath = 'uploads/products/';
    } else if (file.fieldname === 'category_image') {
      uploadPath = 'uploads/categories/';
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const fileName = `${uuidv4()}${fileExtension}`;
    cb(null, fileName);
  }
});

/**
 * Configuration de stockage en mémoire (pour traitement)
 */
const memoryStorage = multer.memoryStorage();

/**
 * Filtre pour valider les types de fichiers
 */
const fileFilter = (req, file, cb) => {
  const isImage = ALLOWED_IMAGE_TYPES.hasOwnProperty(file.mimetype);
  const isDocument = ALLOWED_DOCUMENT_TYPES.hasOwnProperty(file.mimetype);
  
  if (isImage || isDocument) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
  }
};

/**
 * Configuration Multer pour upload local
 */
const uploadLocal = multer({
  storage: localStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB par défaut
    files: 10 // Maximum 10 fichiers
  },
  fileFilter: fileFilter
});

/**
 * Configuration Multer pour upload en mémoire (traitement d'images)
 */
const uploadMemory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    files: 10
  },
  fileFilter: fileFilter
});

/**
 * Service de traitement des images avec Sharp
 */
const imageProcessor = {
  /**
   * Redimensionner et optimiser une image
   */
  processImage: async (buffer, options = {}) => {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'jpeg',
      fit = 'cover'
    } = options;

    try {
      const processedBuffer = await sharp(buffer)
        .resize(width, height, { 
          fit: fit,
          position: 'center',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .toFormat(format, { 
          quality: quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      console.error('Erreur traitement image:', error);
      throw new Error('Impossible de traiter l\'image');
    }
  },

  /**
   * Créer plusieurs tailles d'une image
   */
  createVariants: async (buffer, baseName, outputDir) => {
    const variants = {
      thumbnail: { width: 150, height: 150, fit: 'cover' },
      small: { width: 300, height: 300, fit: 'cover' },
      medium: { width: 600, height: 600, fit: 'inside' },
      large: { width: 1200, height: 1200, fit: 'inside' }
    };

    const results = {};

    for (const [variantName, options] of Object.entries(variants)) {
      try {
        const processedBuffer = await imageProcessor.processImage(buffer, options);
        const fileName = `${baseName}_${variantName}.jpg`;
        const filePath = path.join(outputDir, fileName);
        
        await fs.writeFile(filePath, processedBuffer);
        results[variantName] = fileName;
      } catch (error) {
        console.error(`Erreur création variant ${variantName}:`, error);
      }
    }

    return results;
  },

  /**
   * Extraire les métadonnées d'une image
   */
  getMetadata: async (buffer) => {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha
      };
    } catch (error) {
      console.error('Erreur extraction métadonnées:', error);
      return null;
    }
  }
};

/**
 * Service d'upload unifié
 */
const uploadService = {
  /**
   * Upload d'image utilisateur (avatar)
   */
  uploadUserAvatar: uploadMemory.single('avatar'),

  /**
   * Upload d'images de boutique (logo, bannière)
   */
  uploadStoreImages: uploadMemory.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]),

  /**
   * Upload d'images de produit
   */
  uploadProductImages: uploadMemory.array('product_images', 8),

  /**
   * Upload d'image de catégorie
   */
  uploadCategoryImage: uploadMemory.single('category_image'),

  /**
   * Upload de documents
   */
  uploadDocuments: uploadLocal.array('documents', 5),

  /**
   * Traiter et sauvegarder un avatar utilisateur
   */
  processUserAvatar: async (file, userId) => {
    if (!file || !file.buffer) {
      throw new Error('Fichier avatar manquant');
    }

    try {
      const outputDir = 'uploads/users/';
      const baseName = `avatar_${userId}_${Date.now()}`;
      
      // Créer le dossier s'il n'existe pas
      await fs.mkdir(outputDir, { recursive: true });
      
      // Traiter l'image principale (carré, 300x300)
      const processedBuffer = await imageProcessor.processImage(file.buffer, {
        width: 300,
        height: 300,
        fit: 'cover',
        quality: 85
      });
      
      const fileName = `${baseName}.jpg`;
      const filePath = path.join(outputDir, fileName);
      
      await fs.writeFile(filePath, processedBuffer);
      
      return {
        fileName,
        originalName: file.originalname,
        path: `/${filePath}`,
        url: `${process.env.BASE_URL || 'http://localhost:5000'}/${filePath}`,
        size: processedBuffer.length
      };
      
    } catch (error) {
      console.error('Erreur traitement avatar:', error);
      throw new Error('Impossible de traiter l\'avatar');
    }
  },

  /**
   * Traiter et sauvegarder les images de boutique
   */
  processStoreImages: async (files, storeId) => {
    const results = {};
    
    try {
      const outputDir = 'uploads/stores/';
      await fs.mkdir(outputDir, { recursive: true });
      
      // Traiter le logo
      if (files.logo && files.logo[0]) {
        const logoBuffer = await imageProcessor.processImage(files.logo[0].buffer, {
          width: 200,
          height: 200,
          fit: 'contain',
          quality: 90
        });
        
        const logoFileName = `logo_${storeId}_${Date.now()}.jpg`;
        const logoPath = path.join(outputDir, logoFileName);
        
        await fs.writeFile(logoPath, logoBuffer);
        
        results.logo = {
          fileName: logoFileName,
          path: `/${logoPath}`,
          url: `${process.env.BASE_URL || 'http://localhost:5000'}/${logoPath}`
        };
      }
      
      // Traiter la bannière
      if (files.banner && files.banner[0]) {
        const bannerBuffer = await imageProcessor.processImage(files.banner[0].buffer, {
          width: 1200,
          height: 400,
          fit: 'cover',
          quality: 85
        });
        
        const bannerFileName = `banner_${storeId}_${Date.now()}.jpg`;
        const bannerPath = path.join(outputDir, bannerFileName);
        
        await fs.writeFile(bannerPath, bannerBuffer);
        
        results.banner = {
          fileName: bannerFileName,
          path: `/${bannerPath}`,
          url: `${process.env.BASE_URL || 'http://localhost:5000'}/${bannerPath}`
        };
      }
      
      return results;
      
    } catch (error) {
      console.error('Erreur traitement images boutique:', error);
      throw new Error('Impossible de traiter les images de boutique');
    }
  },

  /**
   * Traiter et sauvegarder les images de produit
   */
  processProductImages: async (files, productId) => {
    if (!files || files.length === 0) {
      return [];
    }

    try {
      const outputDir = 'uploads/products/';
      await fs.mkdir(outputDir, { recursive: true });
      
      const results = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const baseName = `product_${productId}_${Date.now()}_${i}`;
        
        // Créer les variants de l'image
        const variants = await imageProcessor.createVariants(file.buffer, baseName, outputDir);
        
        // Créer l'image principale
        const mainBuffer = await imageProcessor.processImage(file.buffer, {
          width: 800,
          height: 800,
          fit: 'inside',
          quality: 85
        });
        
        const mainFileName = `${baseName}.jpg`;
        const mainPath = path.join(outputDir, mainFileName);
        
        await fs.writeFile(mainPath, mainBuffer);
        
        results.push({
          original: {
            fileName: mainFileName,
            path: `/${mainPath}`,
            url: `${process.env.BASE_URL || 'http://localhost:5000'}/${mainPath}`
          },
          variants: Object.keys(variants).reduce((acc, variant) => {
            acc[variant] = {
              fileName: variants[variant],
              url: `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/products/${variants[variant]}`
            };
            return acc;
          }, {}),
          metadata: await imageProcessor.getMetadata(file.buffer)
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Erreur traitement images produit:', error);
      throw new Error('Impossible de traiter les images de produit');
    }
  },

  /**
   * Supprimer un fichier
   */
  deleteFile: async (filePath) => {
    try {
      await fs.unlink(filePath);
      console.log(`✅ Fichier supprimé: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur suppression fichier ${filePath}:`, error);
      return false;
    }
  },

  /**
   * Nettoyer les fichiers temporaires anciens
   */
  cleanupTempFiles: async (maxAge = 24 * 60 * 60 * 1000) => { // 24h par défaut
    try {
      const tempDir = 'uploads/temp/';
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      console.log(`✅ Nettoyage terminé: ${deletedCount} fichiers temporaires supprimés`);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Erreur nettoyage fichiers temporaires:', error);
      return 0;
    }
  }
};

/**
 * Middleware d'upload avec gestion d'erreur
 */
const uploadMiddleware = (uploadType) => {
  return (req, res, next) => {
    uploadType(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'Fichier trop volumineux',
            code: 'FILE_TOO_LARGE',
            maxSize: process.env.MAX_FILE_SIZE || '5MB'
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'Trop de fichiers',
            code: 'TOO_MANY_FILES'
          });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            error: 'Champ de fichier inattendu',
            code: 'UNEXPECTED_FIELD'
          });
        }
      }
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'UPLOAD_ERROR'
        });
      }
      
      next();
    });
  };
};

module.exports = {
  uploadService,
  uploadMiddleware,
  imageProcessor,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES
};