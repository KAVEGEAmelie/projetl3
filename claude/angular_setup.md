# Configuration Frontend Angular - AfrikMode 🎨

Guide pour configurer la partie frontend Angular du projet AfrikMode.

## 📁 Structure des projets Angular

```
A:\projets\projet-thesymo\thesymo-platform\
├── client-app/          # Application client (e-commerce public)
├── admin-app/           # Application admin (backoffice)
├── shared/             # Librairies partagées
└── README.md
```

## 🚀 Installation et configuration

### 1. Installer Angular CLI

```bash
npm install -g @angular/cli@16
```

### 2. Créer les applications

```bash
cd A:\projets\projet-thesymo\thesymo-platform

# Créer l'application client
ng new client-app --routing --style=scss --package-manager=npm
cd client-app
npm install @angular/material @angular/cdk @angular/animations
npm install @angular/flex-layout
npm install ngx-toastr
npm install ngx-loading
npm install swiper

# Retour au dossier parent
cd ..

# Créer l'application admin
ng new admin-app --routing --style=scss --package-manager=npm
cd admin-app
npm install @angular/material @angular/cdk @angular/animations
npm install @angular/flex-layout
npm install ngx-toastr
npm install chart.js ng2-charts
npm install @angular/google-maps
```

### 3. Configuration Angular Material

Dans `client-app/src/app/app.module.ts` :

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Material imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';

// Third-party
import { ToastrModule } from 'ngx-toastr';
import { FlexLayoutModule } from '@angular/flex-layout';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    FlexLayoutModule,
    
    // Material modules
    MatToolbarModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatGridListModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatChipsModule,
    MatTabsModule,
    
    // Third-party
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### 4. Configuration des thèmes

Créer `client-app/src/theme.scss` :

```scss
@use '@angular/material' as mat;

// Couleurs AfrikMode
$afrikmode-primary: (
  50: #fef7f0,
  100: #fdeee0,
  200: #fad4b8,
  300: #f6ba90,
  400: #f3a169,
  500: #ef8741,  // Couleur principale orange
  600: #d9744f,  // Orange secondaire
  700: #bf5d35,
  800: #a64d28,
  900: #8b2e2e,  // Rouge-brun principal
  A100: #ffd6cc,
  A200: #ffab99,
  A400: #ff8066,
  A700: #ff6b4d,
  contrast: (
    50: rgba(black, 0.87),
    100: rgba(black, 0.87),
    200: rgba(black, 0.87),
    300: rgba(black, 0.87),
    400: rgba(black, 0.87),
    500: white,
    600: white,
    700: white,
    800: white,
    900: white,
    A100: rgba(black, 0.87),
    A200: rgba(black, 0.87),
    A400: white,
    A700: white,
  )
);

$afrikmode-accent: (
  50: #f7f8e8,
  100: #eaedca,
  200: #dde2a8,
  300: #d0d786,
  400: #c5ce6d,
  500: #bac554,
  600: #a8b34c,
  700: #949f42,
  800: #818b38,
  900: #6b8e23,  // Vert sauge principal
  A100: #f0f7d4,
  A200: #e1f0a8,
  A400: #d1e87c,
  A700: #c9e563,
  contrast: (
    50: rgba(black, 0.87),
    100: rgba(black, 0.87),
    200: rgba(black, 0.87),
    300: rgba(black, 0.87),
    400: rgba(black, 0.87),
    500: rgba(black, 0.87),
    600: rgba(black, 0.87),
    700: white,
    800: white,
    900: white,
    A100: rgba(black, 0.87),
    A200: rgba(black, 0.87),
    A400: rgba(black, 0.87),
    A700: rgba(black, 0.87),
  )
);

// Créer les palettes
$primary: mat.define-palette($afrikmode-primary, 900); // Rouge-brun
$accent: mat.define-palette($afrikmode-accent, 900);   // Vert sauge
$warn: mat.define-palette(mat.$red-palette);

// Créer le thème
$theme: mat.define-light-theme((
  color: (
    primary: $primary,
    accent: $accent,
    warn: $warn,
  ),
  typography: mat.define-typography-config(),
  density: 0,
));

// Appliquer le thème
@include mat.all-component-themes($theme);

// Styles personnalisés AfrikMode
:root {
  --primary-color: #8B2E2E;
  --secondary-color: #D9744F;
  --accent-color: #6B8E23;
  --background-color: #FFF9F6;
  --surface-color: #FFFFFF;
  --text-primary: #3A3A3A;
  --text-secondary: #666666;
  --border-color: #F5E4D7;
}

// Classes utilitaires
.primary-color { color: var(--primary-color) !important; }
.secondary-color { color: var(--secondary-color) !important; }
.accent-color { color: var(--accent-color) !important; }

.primary-bg { background-color: var(--primary-color) !important; }
.secondary-bg { background-color: var(--secondary-color) !important; }
.accent-bg { background-color: var(--accent-color) !important; }
```

### 5. Services de base

Créer `client-app/src/app/core/services/api.service.ts` :

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  // GET request
  get<T>(endpoint: string, params?: any): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<any>(`${this.apiUrl}${endpoint}`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // POST request
  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<any>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // PUT request
  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<any>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // DELETE request
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<any>(`${this.apiUrl}${endpoint}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => error);
  }
}
```

### 6. Configuration des environnements

`client-app/src/environments/environment.ts` :

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  appName: 'AfrikMode',
  version: '1.0.0'
};
```

`client-app/src/environments/environment.prod.ts` :

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.afrikmode.com/api',
  appName: 'AfrikMode',
  version: '1.0.0'
};
```

### 7. Interface utilisateur de base

Créer `client-app/src/app/shared/models/user.model.ts` :

```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: 'customer' | 'vendor' | 'manager' | 'admin' | 'super_admin';
  status: string;
  verified: {
    email: boolean;
    phone: boolean;
  };
  preferences: {
    language: string;
    currency: string;
  };
  loyalty: {
    points: number;
    tier: string;
  };
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  city?: string;
}
```

### 8. Service d'authentification

Créer `client-app/src/app/core/services/auth.service.ts` :

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginRequest, RegisterRequest } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private apiService: ApiService) {
    this.loadUserFromStorage();
  }

  login(credentials: LoginRequest): Observable<any> {
    return this.apiService.post('/auth/login', credentials).pipe(
      tap((response: any) => {
        this.setSession(response);
      })
    );
  }

  register(userData: RegisterRequest): Observable<any> {
    return this.apiService.post('/auth/register', userData);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): Observable<User> {
    return this.apiService.get('/auth/me');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  private setSession(authResult: any): void {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('user', JSON.stringify(authResult.user));
    this.currentUserSubject.next(authResult.user);
  }

  private loadUserFromStorage(): void {
    const user = localStorage.getItem('user');
    if (user) {
      this.currentUserSubject.next(JSON.parse(user));
    }
  }
}
```

### 9. Guard d'authentification

Créer `client-app/src/app/core/guards/auth.guard.ts` :

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    } else {
      this.router.navigate(['/auth/login']);
      return false;
    }
  }
}
```

### 10. Structure des modules

Créer la structure modulaire :

```bash
cd client-app/src/app

# Modules principaux
ng generate module core
ng generate module shared
ng generate module features/auth
ng generate module features/products
ng generate module features/stores
ng generate module features/orders
ng generate module layout

# Composants de layout
ng generate component layout/header
ng generate component layout/footer
ng generate component layout/sidebar

# Pages d'authentification
ng generate component features/auth/login
ng generate component features/auth/register

# Pages produits
ng generate component features/products/product-list
ng generate component features/products/product-detail
ng generate component features/products/product-card
```

### 11. Configuration du routing

`client-app/src/app/app-routing.module.ts` :

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'products',
    loadChildren: () => import('./features/products/products.module').then(m => m.ProductsModule)
  },
  {
    path: 'stores',
    loadChildren: () => import('./features/stores/stores.module').then(m => m.StoresModule)
  },
  {
    path: 'account',
    loadChildren: () => import('./features/account/account.module').then(m => m.AccountModule),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### 12. Scripts de démarrage

Ajouter dans `client-app/package.json` :

```json
{
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "start:dev": "ng serve --host 0.0.0.0 --port 4200",
    "build": "ng build",
    "build:prod": "ng build --configuration production",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "lint": "ng lint"
  }
}
```

## 🚀 Démarrage des applications

### Application Client (E-commerce)

```bash
cd client-app
npm start
# Accessible sur http://localhost:4200
```

### Application Admin (Backoffice)

```bash
cd admin-app
npm start
# Accessible sur http://localhost:4201
```

## 🎨 Identité visuelle

Les couleurs AfrikMode sont configurées dans le thème :

- **Primary (Rouge-brun)** : `#8B2E2E`
- **Secondary (Orange)** : `#D9744F`
- **Accent (Vert sauge)** : `#6B8E23`
- **Background** : `#FFF9F6`
- **Surface** : `#FFFFFF`

## 📱 Responsive Design

Le design utilise Angular Flex Layout pour la responsivité :

```html
<div fxLayout="row" fxLayout.xs="column" fxLayoutGap="20px">
  <div fxFlex="30" fxFlex.xs="100">Sidebar</div>
  <div fxFlex="70" fxFlex.xs="100">Content</div>
</div>
```

## 🔧 Prochaines étapes

1. **Développer les composants** de base (header, footer, product-card)
2. **Implémenter l'authentification** complète
3. **Créer les pages produits** avec filtres et recherche
4. **Développer le panier** et le processus de commande
5. **Intégrer les paiements** mobile money
6. **Ajouter les analytics** dans l'admin
7. **Optimiser les performances** et le SEO

## 📞 Support

- **Frontend Client** : http://localhost:4200
- **Frontend Admin** : http://localhost:4201
- **API Backend** : http://localhost:5000
- **Documentation** : Voir README.md du backend

---

Avec cette configuration, vous avez une base solide pour développer les interfaces Angular de AfrikMode ! 🎨✨