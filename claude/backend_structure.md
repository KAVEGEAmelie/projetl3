# 📁 Structure du Backend AfrikMode

Créez cette structure de dossiers dans `A:\projets\projet-thesymo\backend\`:

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── mail.js
│   │   └── storage.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── categoryController.js
│   │   ├── storeController.js
│   │   ├── paymentController.js
│   │   └── analyticsController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── Category.js
│   │   ├── Store.js
│   │   ├── Payment.js
│   │   └── Review.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── categories.js
│   │   ├── stores.js
│   │   ├── payments.js
│   │   └── analytics.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── upload.js
│   │   ├── rateLimiter.js
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── emailService.js
│   │   ├── paymentService.js
│   │   ├── uploadService.js
│   │   ├── notificationService.js
│   │   └── analyticsService.js
│   ├── utils/
│   │   ├── helpers.js
│   │   ├── constants.js
│   │   └── validators.js
│   └── server.js
├── migrations/
├── seeds/
├── uploads/
│   ├── products/
│   ├── users/
│   └── temp/
├── tests/
│   ├── controllers/
│   ├── models/
│   └── routes/
├── .env.example
├── .gitignore
├── knexfile.js
├── Dockerfile
└── README.md
```

## 🛠️ Commandes pour créer la structure :

**Windows (Command Prompt):**
```cmd
cd A:\projets\projet-thesymo\backend
mkdir src\config src\controllers src\models src\routes src\middleware src\services src\utils
mkdir migrations seeds uploads\products uploads\users uploads\temp tests\controllers tests\models tests\routes
```

**Ou PowerShell:**
```powershell
cd A:\projets\projet-thesymo\backend
New-Item -ItemType Directory -Path "src\config", "src\controllers", "src\models", "src\routes", "src\middleware", "src\services", "src\utils", "migrations", "seeds", "uploads\products", "uploads\users", "uploads\temp", "tests\controllers", "tests\models", "tests\routes"
```
