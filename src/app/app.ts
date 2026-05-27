import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AppStatus = 'Online' | 'Revision' | 'Interna';

interface CompanyApp {
  name: string;
  description: string;
  category: string;
  group: string;
  owner: string;
  url: string;
  status: AppStatus;
  initials: string;
  icon: string;
}

interface AuthUser {
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

type AuthMode = 'login' | 'register';

declare global {
  interface Window {
    __MONTAO_INDEX_API_URL__?: string;
  }
}

function getApiUrl(): string {
  if (window.__MONTAO_INDEX_API_URL__) {
    return window.__MONTAO_INDEX_API_URL__;
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }

  return 'https://index-backend.montao.net/api';
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly apiUrl = getApiUrl();
  private readonly tokenKey = 'montao_index_token';
  private readonly userKey = 'montao_index_user';

  protected readonly apps = signal<CompanyApp[]>([]);
  protected readonly authMode = signal<AuthMode>('login');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly authToken = signal<string | null>(null);
  protected readonly user = signal<AuthUser | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly isLoading = signal(false);
  protected readonly ssoLoadingApp = signal('');

  protected readonly groupedApps = computed(() =>
    ['Productividad', 'Operaciones', 'Finanzas y Analitica']
      .map((group) => ({
        group,
        apps: this.apps().filter((app) => app.group === group),
      }))
      .filter((section) => section.apps.length > 0),
  );

  ngOnInit(): void {
    const token = localStorage.getItem(this.tokenKey);
    const savedUser = localStorage.getItem(this.userKey);

    if (token) {
      this.authToken.set(token);
      this.user.set(savedUser ? JSON.parse(savedUser) : null);
      void this.loadApps();
    }
  }

  protected updateEmail(value: string): void {
    this.email.set(value);
  }

  protected updateName(value: string): void {
    this.name.set(value);
  }

  protected updatePassword(value: string): void {
    this.password.set(value);
  }

  protected setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.errorMessage.set('');
    this.password.set('');
  }

  protected async submitAuth(): Promise<void> {
    if (this.authMode() === 'register') {
      await this.register();
      return;
    }

    await this.login();
  }

  protected async login(): Promise<void> {
    this.errorMessage.set('');
    this.isLoading.set(true);

    try {
      const response = await fetch(`${this.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email().trim(),
          password: this.password(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo iniciar sesion' }));
        throw new Error(payload.message || 'No se pudo iniciar sesion');
      }

      const payload = (await response.json()) as LoginResponse;
      this.setSession(payload);
      await this.loadApps();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async register(): Promise<void> {
    this.errorMessage.set('');
    this.isLoading.set(true);

    try {
      const response = await fetch(`${this.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.name().trim(),
          email: this.email().trim(),
          password: this.password(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo registrar' }));
        throw new Error(payload.message || 'No se pudo registrar');
      }

      const payload = (await response.json()) as LoginResponse;
      this.setSession(payload);
      await this.loadApps();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo registrar');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.authToken.set(null);
    this.user.set(null);
    this.apps.set([]);
    this.password.set('');
  }

  protected isMontaoGpsApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('gps');
  }

  protected async openApp(app: CompanyApp, event: Event): Promise<void> {
    if (!this.isMontaoGpsApp(app)) {
      return;
    }

    event.preventDefault();
    this.errorMessage.set('');
    this.ssoLoadingApp.set(app.name);

    try {
      const token = this.authToken();
      const response = await fetch(`${this.apiUrl}/sso/montao-gps`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo abrir Montao GPS' }));
        throw new Error(payload.message || 'No se pudo abrir Montao GPS');
      }

      const payload = (await response.json()) as { redirectUrl: string };
      window.open(payload.redirectUrl, '_blank', 'noopener');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo abrir Montao GPS');
    } finally {
      this.ssoLoadingApp.set('');
    }
  }

  private setSession(payload: LoginResponse): void {
    localStorage.setItem(this.tokenKey, payload.token);
    localStorage.setItem(this.userKey, JSON.stringify(payload.user));
    this.authToken.set(payload.token);
    this.user.set(payload.user);
    this.password.set('');
  }

  private async loadApps(): Promise<void> {
    const token = this.authToken();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        this.logout();
        this.errorMessage.set('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      if (!response.ok) {
        throw new Error('No se pudieron cargar las aplicaciones');
      }

      this.apps.set((await response.json()) as CompanyApp[]);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No se pudieron cargar las aplicaciones',
      );
    }
  }
}
