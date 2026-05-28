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

interface AppNode extends CompanyApp {
  index: number;
  x: number;
  y: number;
}

interface AppNodeLink {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMontaoGpsConnection: boolean;
  isMontaoRentConnection: boolean;
  isMontaoCrmConnection: boolean;
  isMontaoGpsRentConnection: boolean;
  isMontaoCrmRentConnection: boolean;
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
type DashboardViewMode = 'network' | 'grid';
type WorkspaceView = 'dashboard' | 'settings';
type ThemeMode = 'dark' | 'light';

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
  private readonly themeKey = 'montao_index_theme';

  protected readonly apps = signal<CompanyApp[]>([]);
  protected readonly authMode = signal<AuthMode>('login');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly profileName = signal('');
  protected readonly profileEmail = signal('');
  protected readonly profilePassword = signal('');
  protected readonly profilePasswordConfirm = signal('');
  protected readonly profileMessage = signal('');
  protected readonly isSavingProfile = signal(false);
  protected readonly authToken = signal<string | null>(null);
  protected readonly user = signal<AuthUser | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly isLoading = signal(false);
  protected readonly ssoLoadingApp = signal('');
  protected readonly dashboardViewMode = signal<DashboardViewMode>('network');
  protected readonly workspaceView = signal<WorkspaceView>('dashboard');
  protected readonly themeMode = signal<ThemeMode>('dark');
  protected readonly montaoGpsUserExists = signal(false);
  protected readonly montaoRentUserExists = signal(false);
  protected readonly montaoCrmUserExists = signal(false);
  private readonly nodePositions = [
    { x: 50, y: 16 },
    { x: 78, y: 33 },
    { x: 72, y: 74 },
    { x: 28, y: 74 },
    { x: 22, y: 33 },
    { x: 50, y: 88 },
    { x: 12, y: 54 },
    { x: 88, y: 54 },
    { x: 50, y: 50 },
  ];

  protected readonly groupedApps = computed(() =>
    ['Productividad', 'Operaciones', 'Finanzas y Analitica']
      .map((group) => ({
        group,
        apps: this.apps().filter((app) => app.group === group),
      }))
      .filter((section) => section.apps.length > 0),
  );

  protected readonly appNodes = computed<AppNode[]>(() =>
    this.apps().map((app, index) => ({
      ...app,
      index,
      ...this.nodePositions[index % this.nodePositions.length],
    })),
  );

  protected readonly appNodeLinks = computed<AppNodeLink[]>(() => {
    const nodes = this.appNodes();
    const links: AppNodeLink[] = [];

    if (nodes.length < 2) {
      return links;
    }

    for (const node of nodes) {
      links.push({
        id: `core-${node.index}`,
        x1: 50,
        y1: 50,
        x2: node.x,
        y2: node.y,
        isMontaoGpsConnection: this.isMontaoGpsApp(node),
        isMontaoRentConnection: this.isMontaoRentApp(node),
        isMontaoCrmConnection: this.isMontaoCrmApp(node),
        isMontaoGpsRentConnection: false,
        isMontaoCrmRentConnection: false,
      });
    }

    for (let index = 0; index < nodes.length - 1; index += 1) {
      const from = nodes[index];
      const to = nodes[index + 1];

      if (
        this.isMontaoTalleresApp(from) ||
        this.isMontaoTalleresApp(to) ||
        this.isGpsMetricasNodePair(from, to)
      ) {
        continue;
      }

      links.push(this.createNodeLink(from, to, `chain-${index}`));
    }

    const crmNode = nodes.find((node) => node.name.toLowerCase().includes('crm'));
    const billingNode = nodes.find((node) => node.name.toLowerCase().includes('facturacion'));

    if (crmNode && billingNode) {
      links.push(this.createNodeLink(billingNode, crmNode, 'facturacion-crm'));
    }

    const gpsNode = nodes.find((node) => this.isMontaoGpsApp(node));
    const rentNode = nodes.find((node) => this.isMontaoRentApp(node));
    const hasGpsRentLink = links.some((link) => link.isMontaoGpsRentConnection);

    if (gpsNode && rentNode && !hasGpsRentLink) {
      links.push(this.createNodeLink(gpsNode, rentNode, 'montao-gps-rent'));
    }

    const hasCrmRentLink = links.some((link) => link.isMontaoCrmRentConnection);

    if (crmNode && rentNode && !hasCrmRentLink) {
      links.push(this.createNodeLink(crmNode, rentNode, 'montao-crm-rent'));
    }

    const talleresNode = nodes.find((node) => this.isMontaoTalleresApp(node));
    const metricasNode = nodes.find((node) => this.isMontaoMetricasApp(node));

    if (talleresNode && gpsNode) {
      links.push(this.createNodeLink(talleresNode, gpsNode, 'montao-talleres-gps'));
    }

    if (talleresNode && metricasNode) {
      links.push(this.createNodeLink(talleresNode, metricasNode, 'montao-talleres-metricas'));
    }

    return links;
  });

  ngOnInit(): void {
    const savedTheme = localStorage.getItem(this.themeKey);
    const token = localStorage.getItem(this.tokenKey);
    const savedUser = localStorage.getItem(this.userKey);

    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.themeMode.set(savedTheme);
    }

    if (token) {
      const parsedUser = savedUser ? (JSON.parse(savedUser) as AuthUser) : null;
      this.authToken.set(token);
      this.user.set(parsedUser);
      this.profileName.set(parsedUser?.name || '');
      this.profileEmail.set(parsedUser?.email || '');
      void this.loadDashboardData();
      window.setTimeout(() => void this.loadExternalUserStatuses(), 500);
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

  protected setThemeMode(mode: string): void {
    if (mode !== 'light' && mode !== 'dark') {
      return;
    }

    this.themeMode.set(mode);
    localStorage.setItem(this.themeKey, mode);
  }

  protected updateProfileName(value: string): void {
    this.profileName.set(value);
    this.profileMessage.set('');
  }

  protected updateProfileEmail(value: string): void {
    this.profileEmail.set(value);
    this.profileMessage.set('');
  }

  protected updateProfilePassword(value: string): void {
    this.profilePassword.set(value);
    this.profileMessage.set('');
  }

  protected updateProfilePasswordConfirm(value: string): void {
    this.profilePasswordConfirm.set(value);
    this.profileMessage.set('');
  }

  protected async saveProfile(): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    if (this.profilePassword() !== this.profilePasswordConfirm()) {
      this.profileMessage.set('Las contrasenas no coinciden');
      return;
    }

    this.errorMessage.set('');
    this.profileMessage.set('');
    this.isSavingProfile.set(true);

    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.profileName().trim(),
          email: this.profileEmail().trim(),
          password: this.profilePassword(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo guardar el usuario' }));
        throw new Error(payload.message || 'No se pudo guardar el usuario');
      }

      const payload = (await response.json()) as LoginResponse;
      this.setSession(payload);
      this.profilePassword.set('');
      this.profilePasswordConfirm.set('');
      this.profileMessage.set('Usuario actualizado');
    } catch (error) {
      this.profileMessage.set(error instanceof Error ? error.message : 'No se pudo guardar el usuario');
    } finally {
      this.isSavingProfile.set(false);
    }
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
      await this.loadExternalUserStatuses();
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
      await this.loadExternalUserStatuses();
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
    this.montaoGpsUserExists.set(false);
    this.montaoRentUserExists.set(false);
    this.montaoCrmUserExists.set(false);
    this.password.set('');
    this.profileName.set('');
    this.profileEmail.set('');
    this.profilePassword.set('');
    this.profilePasswordConfirm.set('');
    this.profileMessage.set('');
  }

  protected isMontaoGpsApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('gps');
  }

  protected isMontaoRentApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('rent');
  }

  protected isMontaoCrmApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('crm');
  }

  protected isMontaoTalleresApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('taller');
  }

  protected isMontaoMetricasApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('metrica');
  }

  protected isVerifiedLink(link: AppNodeLink): boolean {
    return (
      (link.isMontaoGpsConnection && this.montaoGpsUserExists()) ||
      (link.isMontaoRentConnection && this.montaoRentUserExists()) ||
      (link.isMontaoCrmConnection && this.montaoCrmUserExists()) ||
      (link.isMontaoGpsRentConnection && this.montaoGpsUserExists() && this.montaoRentUserExists()) ||
      (link.isMontaoCrmRentConnection && this.montaoCrmUserExists() && this.montaoRentUserExists())
    );
  }

  protected isConnectedApp(app: CompanyApp): boolean {
    if (this.isMontaoGpsApp(app)) {
      return this.montaoGpsUserExists();
    }

    if (this.isMontaoRentApp(app)) {
      return this.montaoRentUserExists();
    }

    if (this.isMontaoCrmApp(app)) {
      return this.montaoCrmUserExists();
    }

    return false;
  }

  protected displayAppName(app: CompanyApp): string {
    return this.isMontaoGpsApp(app) ? 'Montao GPS' : app.name;
  }

  protected appLogoUrl(app: CompanyApp): string {
    const appName = app.name.toLowerCase();

    if (appName.includes('gps')) {
      return '/logogps.png';
    }

    if (appName.includes('crm')) {
      return '/logocrm.png';
    }

    if (this.isMontaoRentApp(app)) {
      return '/logorenta.png';
    }

    if (appName.includes('facturacion') || appName.includes('factura')) {
      return '/logofactura.png';
    }

    if (appName.includes('metrica')) {
      return '/logometricas.png';
    }

    if (this.isMontaoTalleresApp(app)) {
      return '/logotaller.png';
    }

    return '';
  }

  protected async openApp(app: CompanyApp, event: Event): Promise<void> {
    if (!this.isSsoApp(app)) {
      return;
    }

    event.preventDefault();
    this.errorMessage.set('');
    const displayName = this.displayAppName(app);
    this.ssoLoadingApp.set(displayName);

    try {
      const token = this.authToken();
      const ssoPath = this.ssoPathForApp(app);
      const response = await fetch(`${this.apiUrl}/sso/${ssoPath}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: `No se pudo abrir ${displayName}` }));
        throw new Error(payload.message || `No se pudo abrir ${displayName}`);
      }

      const payload = (await response.json()) as { redirectUrl: string };
      window.open(payload.redirectUrl, '_blank', 'noopener');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : `No se pudo abrir ${displayName}`);
    } finally {
      this.ssoLoadingApp.set('');
    }
  }

  private isSsoApp(app: CompanyApp): boolean {
    return this.isMontaoGpsApp(app) || this.isMontaoRentApp(app) || this.isMontaoCrmApp(app);
  }

  private ssoPathForApp(app: CompanyApp): string {
    if (this.isMontaoRentApp(app)) {
      return 'montao-rent';
    }

    if (this.isMontaoCrmApp(app)) {
      return 'montao-crm';
    }

    return 'montao-gps';
  }

  private setSession(payload: LoginResponse): void {
    localStorage.setItem(this.tokenKey, payload.token);
    localStorage.setItem(this.userKey, JSON.stringify(payload.user));
    this.authToken.set(payload.token);
    this.user.set(payload.user);
    this.profileName.set(payload.user.name || '');
    this.profileEmail.set(payload.user.email || '');
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

  private async loadDashboardData(): Promise<void> {
    await this.loadApps();
    await this.loadExternalUserStatuses();
  }

  private createNodeLink(from: AppNode, to: AppNode, id: string): AppNodeLink {
    return {
      id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      isMontaoGpsConnection: false,
      isMontaoRentConnection: false,
      isMontaoCrmConnection: false,
      isMontaoGpsRentConnection: this.isGpsRentNodePair(from, to),
      isMontaoCrmRentConnection: this.isCrmRentNodePair(from, to),
    };
  }

  private isGpsRentNodePair(from: AppNode, to: AppNode): boolean {
    return (
      (this.isMontaoGpsApp(from) && this.isMontaoRentApp(to)) ||
      (this.isMontaoRentApp(from) && this.isMontaoGpsApp(to))
    );
  }

  private isCrmRentNodePair(from: AppNode, to: AppNode): boolean {
    return (
      (this.isMontaoCrmApp(from) && this.isMontaoRentApp(to)) ||
      (this.isMontaoRentApp(from) && this.isMontaoCrmApp(to))
    );
  }

  private isGpsMetricasNodePair(from: AppNode, to: AppNode): boolean {
    return (
      (this.isMontaoGpsApp(from) && this.isMontaoMetricasApp(to)) ||
      (this.isMontaoMetricasApp(from) && this.isMontaoGpsApp(to))
    );
  }

  private async loadExternalUserStatuses(): Promise<void> {
    await Promise.all([
      this.loadMontaoGpsUserStatus(),
      this.loadMontaoRentUserStatus(),
      this.loadMontaoCrmUserStatus(),
    ]);
  }

  private async loadMontaoGpsUserStatus(): Promise<void> {
    const token = this.authToken();
    if (!token) {
      this.montaoGpsUserExists.set(false);
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sso/montao-gps/user-exists`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        this.montaoGpsUserExists.set(false);
        return;
      }

      const payload = (await response.json()) as { exists?: boolean };
      this.montaoGpsUserExists.set(payload.exists === true);
    } catch {
      this.montaoGpsUserExists.set(false);
    }
  }

  private async loadMontaoRentUserStatus(): Promise<void> {
    const token = this.authToken();
    if (!token) {
      this.montaoRentUserExists.set(false);
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sso/montao-rent/user-exists`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        this.montaoRentUserExists.set(false);
        return;
      }

      const payload = (await response.json()) as { exists?: boolean };
      this.montaoRentUserExists.set(payload.exists === true);
    } catch {
      this.montaoRentUserExists.set(false);
    }
  }

  private async loadMontaoCrmUserStatus(): Promise<void> {
    const token = this.authToken();
    if (!token) {
      this.montaoCrmUserExists.set(false);
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sso/montao-crm/user-exists`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        this.montaoCrmUserExists.set(false);
        return;
      }

      const payload = (await response.json()) as { exists?: boolean };
      this.montaoCrmUserExists.set(payload.exists === true);
    } catch {
      this.montaoCrmUserExists.set(false);
    }
  }
}
