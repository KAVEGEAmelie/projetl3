# Utiliser l'image officielle Node.js LTS
FROM node:18-alpine

# Définir les métadonnées de l'image
LABEL maintainer="Equipe AfrikMode <dev@afrikmode.com>"
LABEL description="Backend API pour AfrikMode - Plateforme e-commerce de mode africaine"
LABEL version="1.0.0"

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S afrikmode -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    # Pour les builds natifs
    make \
    gcc \
    g++ \
    python3 \
    # Pour Sharp (traitement d'images)
    vips-dev \
    # Utilitaires
    curl \
    bash

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Créer les dossiers nécessaires avec les bonnes permissions
RUN mkdir -p uploads/products uploads/users uploads/temp logs && \
    chown -R afrikmode:nodejs uploads logs && \
    chmod -R 755 uploads logs

# Définir les variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=5000
ENV LOG_LEVEL=info

# Exposer le port de l'application
EXPOSE 5000

# Basculer vers l'utilisateur non-root
USER afrikmode

# Healthcheck pour vérifier l'état de l'application
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Commande par défaut pour démarrer l'application
CMD ["npm", "start"]

# Optimisations multi-stage pour la production
# Stage de développement (optionnel)
FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
USER afrikmode
CMD ["npm", "run", "dev"]

# Stage de production (par défaut)
FROM node:18-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S afrikmode -u 1001

WORKDIR /app

# Installer les dépendances système pour la production
RUN apk add --no-cache vips-dev curl bash

# Copier les dépendances depuis le build
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY --chown=afrikmode:nodejs . .

# Créer les dossiers avec permissions
RUN mkdir -p uploads/products uploads/users uploads/temp logs && \
    chown -R afrikmode:nodejs uploads logs && \
    chmod -R 755 uploads logs

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=5000

# Exposer le port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Utilisateur non-root
USER afrikmode

# Commande de démarrage
CMD ["npm", "start"]