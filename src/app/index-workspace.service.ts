import { Injectable, computed, signal } from '@angular/core';

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
  isMontaoAdminConnection: boolean;
  isMontaoGpsRentConnection: boolean;
  isMontaoCrmRentConnection: boolean;
}

interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: string;
}

interface PlatformUser {
  id: string;
  email: string;
  name: string;
  role: string;
  delegatedMailboxes: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface MailAddress {
  name: string;
  address: string;
}

interface MailboxStatus {
  configured: boolean;
  email: string;
  selectedMailboxEmail: string;
  mailboxes: MailboxOption[];
  domain: string;
  imapHost: string;
  smtpHost: string;
  messages: number;
  unseen: number;
}

interface MailboxOption {
  email: string;
  label: string;
  own: boolean;
  delegated: boolean;
}

interface MailMessageSummary {
  uid: number;
  mailboxEmail?: string;
  subject: string;
  from: MailAddress[];
  date: string | null;
  unread: boolean;
  flagged: boolean;
  size: number;
}

interface MailMessageDetail extends MailMessageSummary {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

interface MailMessageListResponse {
  box: string;
  mailboxEmail: string;
  total: number;
  messages: MailMessageSummary[];
}

interface MailFolderItem {
  id: string;
  label: string;
  icon: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

type AuthMode = 'login' | 'register';
type DashboardViewMode = 'network' | 'grid';
type ThemeMode = 'dark' | 'light';
type UsernameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

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

@Injectable({ providedIn: 'root' })
export class IndexWorkspaceService {
  private readonly apiUrl = getApiUrl();
  private readonly tokenKey = 'montao_index_token';
  private readonly userKey = 'montao_index_user';
  private readonly themeKey = 'montao_index_theme';
  readonly userEmailDomain = '@montao.net';

  readonly apps = signal<CompanyApp[]>([]);
  readonly authMode = signal<AuthMode>('login');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly profileName = signal('');
  readonly profileEmail = signal('');
  readonly profilePassword = signal('');
  readonly profilePasswordConfirm = signal('');
  readonly profileMessage = signal('');
  readonly isSavingProfile = signal(false);
  readonly platformUsers = signal<PlatformUser[]>([]);
  readonly usersLoading = signal(false);
  readonly usersSaving = signal(false);
  readonly usersDeletingId = signal('');
  readonly usersMessage = signal('');
  readonly usersError = signal('');
  readonly userEditorOpen = signal(false);
  readonly editingUserId = signal('');
  readonly userFormName = signal('');
  readonly userFormEmail = signal('');
  readonly userFormPassword = signal('');
  readonly userFormRole = signal('user');
  readonly userFormDelegatedMailboxes = signal<string[]>([]);
  readonly mailboxAccessModalOpen = signal(false);
  readonly mailboxAccessSearch = signal('');
  readonly mailboxStatus = signal<MailboxStatus | null>(null);
  readonly selectedMailboxEmail = signal('');
  readonly selectedMailBox = signal('INBOX');
  readonly mailMessages = signal<MailMessageSummary[]>([]);
  readonly mailMessagesTotal = signal(0);
  readonly mailSearch = signal('');
  readonly selectedMailMessage = signal<MailMessageDetail | null>(null);
  readonly mailSelectionMode = signal(false);
  readonly mailThreadsEnabled = signal(false);
  readonly mailboxLoading = signal(false);
  readonly mailReading = signal(false);
  readonly mailConfiguring = signal(false);
  readonly mailSending = signal(false);
  readonly mailError = signal('');
  readonly mailMessage = signal('');
  readonly mailConfigEmail = signal('');
  readonly mailConfigPassword = signal('');
  readonly composeOpen = signal(false);
  readonly composeTo = signal('');
  readonly composeCc = signal('');
  readonly composeBcc = signal('');
  readonly composeSubject = signal('');
  readonly composeBody = signal('');
  readonly composeAttachments = signal<File[]>([]);
  readonly usernameAvailabilityStatus = signal<UsernameAvailabilityStatus>('idle');
  readonly usernameAvailabilityMessage = signal('');
  readonly usernameAvailabilityEmail = signal('');
  readonly authToken = signal<string | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly errorMessage = signal('');
  readonly isLoading = signal(false);
  readonly ssoLoadingApp = signal('');
  readonly dashboardViewMode = signal<DashboardViewMode>('grid');
  readonly themeMode = signal<ThemeMode>('dark');
  readonly montaoGpsUserExists = signal(false);
  readonly montaoRentUserExists = signal(false);
  readonly montaoCrmUserExists = signal(false);
  readonly montaoAdminUserExists = signal(false);
  private usernameAvailabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private usernameAvailabilityRequestId = 0;
  readonly mailFolders: MailFolderItem[] = [
    { id: 'INBOX', label: 'Entrada', icon: 'pi-inbox' },
    { id: 'Drafts', label: 'Borradores', icon: 'pi-pencil' },
    { id: 'Sent', label: 'Enviados', icon: 'pi-send' },
    { id: 'Junk', label: 'SPAM', icon: 'pi-ban' },
    { id: 'Trash', label: 'Papelera', icon: 'pi-trash' },
    { id: 'Archive', label: 'Archivo', icon: 'pi-folder' },
  ];
  private readonly nodePositions = [
    { x: 50, y: 16 },
    { x: 63, y: 21 },
    { x: 72, y: 36 },
    { x: 72, y: 58 },
    { x: 63, y: 75 },
    { x: 50, y: 84 },
    { x: 37, y: 75 },
    { x: 28, y: 58 },
    { x: 28, y: 36 },
    { x: 37, y: 21 },
  ];

  readonly groupedApps = computed(() =>
    ['Productividad', 'Operaciones', 'Finanzas y Analitica']
      .map((group) => ({
        group,
        apps: this.apps().filter((app) => app.group === group),
      }))
      .filter((section) => section.apps.length > 0),
  );

  readonly visibleMailMessages = computed(() => {
    const search = this.mailSearch().trim().toLowerCase();
    const messages = this.mailMessages();

    if (!search) {
      return messages;
    }

    return messages.filter((message) =>
      [
        message.subject,
        this.mailAddressLine(message.from),
        this.formatMailDate(message.date),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  });

  readonly mailboxOptions = computed(() => this.mailboxStatus()?.mailboxes || []);

  readonly selectedMailFolderLabel = computed(
    () =>
      this.mailFolders.find((folder) => folder.id === this.selectedMailBox())?.label ||
      this.selectedMailBox(),
  );

  readonly delegatableMailboxUsers = computed(() => {
    const editingId = this.editingUserId();
    return this.platformUsers().filter(
      (user) =>
        user.id !== editingId &&
        user.email.toLowerCase().endsWith(this.userEmailDomain),
    );
  });

  readonly filteredDelegatableMailboxUsers = computed(() => {
    const search = this.mailboxAccessSearch().trim().toLowerCase();
    const users = this.delegatableMailboxUsers();

    if (!search) {
      return users;
    }

    return users.filter((user) =>
      [user.name, user.email].join(' ').toLowerCase().includes(search),
    );
  });

  readonly selectedDelegatedMailboxEmails = computed(() => {
    const usersByEmail = new Map(
      this.platformUsers().map((user) => [user.email.toLowerCase(), user.email]),
    );

    return this.userFormDelegatedMailboxes()
      .map((email) => usersByEmail.get(email.toLowerCase()) || email)
      .sort((a, b) => a.localeCompare(b));
  });

  readonly appNodes = computed<AppNode[]>(() =>
    this.apps().map((app, index) => ({
      ...app,
      index,
      ...this.nodePositions[index % this.nodePositions.length],
    })),
  );

  readonly appNodeLinks = computed<AppNodeLink[]>(() => {
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
        isMontaoAdminConnection: this.isMontaoMarketplaceApp(node),
        isMontaoGpsRentConnection: false,
        isMontaoCrmRentConnection: false,
      });
    }

    const ringNodes = [...nodes].sort((a, b) => this.nodeAngle(a) - this.nodeAngle(b));

    for (let index = 0; index < ringNodes.length; index += 1) {
      const from = ringNodes[index];
      const to = ringNodes[(index + 1) % ringNodes.length];

      links.push(this.createNodeLink(from, to, `ring-${from.index}-${to.index}`));
    }

    return links;
  });

  initialize(): void {
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
      void this.initializeSession();
    }
  }

   updateEmail(value: string): void {
    this.email.set(value);
  }

   updateName(value: string): void {
    this.name.set(value);
  }

   updatePassword(value: string): void {
    this.password.set(value);
  }

   setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.errorMessage.set('');
    this.password.set('');
  }

   setThemeMode(mode: string): void {
    if (mode !== 'light' && mode !== 'dark') {
      return;
    }

    this.themeMode.set(mode);
    localStorage.setItem(this.themeKey, mode);
  }

   canManageUsers(): boolean {
    return this.user()?.role === 'admin';
  }

   updateProfileName(value: string): void {
    this.profileName.set(value);
    this.profileMessage.set('');
  }

   updateProfileEmail(value: string): void {
    this.profileEmail.set(value);
    this.profileMessage.set('');
  }

   updateProfilePassword(value: string): void {
    this.profilePassword.set(value);
    this.profileMessage.set('');
  }

   updateProfilePasswordConfirm(value: string): void {
    this.profilePasswordConfirm.set(value);
    this.profileMessage.set('');
  }

   updateUserFormName(value: string): void {
    this.userFormName.set(value);
    this.clearUsersFeedback();
  }

   updateUserFormEmail(value: string): void {
    if (this.editingUserId()) {
      this.userFormEmail.set(value);
      this.resetUsernameAvailability();
      this.clearUsersFeedback();
      return;
    }

    this.userFormEmail.set(this.cleanUsername(value));
    this.clearUsersFeedback();
    this.scheduleUsernameAvailabilityCheck();
  }

   isUsernameSaveBlocked(): boolean {
    return (
      !this.editingUserId() &&
      (this.usernameAvailabilityStatus() === 'checking' ||
        this.usernameAvailabilityStatus() === 'taken')
    );
  }

   updateUserFormPassword(value: string): void {
    this.userFormPassword.set(value);
    this.clearUsersFeedback();
  }

   updateUserFormRole(value: string): void {
    this.userFormRole.set(value === 'admin' ? 'admin' : 'user');
    this.clearUsersFeedback();
  }

   isDelegatedMailboxSelected(email: string): boolean {
    return this.userFormDelegatedMailboxes().includes(email.toLowerCase());
  }

   toggleUserDelegatedMailbox(email: string, event: Event): void {
    const cleanEmail = email.trim().toLowerCase();
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    const current = this.userFormDelegatedMailboxes();

    this.userFormDelegatedMailboxes.set(
      checked
        ? Array.from(new Set([...current, cleanEmail]))
        : current.filter((item) => item !== cleanEmail),
    );
    this.clearUsersFeedback();
  }

   openMailboxAccessModal(): void {
    if (!this.delegatableMailboxUsers().length) {
      return;
    }

    this.mailboxAccessSearch.set('');
    this.mailboxAccessModalOpen.set(true);
  }

   closeMailboxAccessModal(): void {
    this.mailboxAccessModalOpen.set(false);
    this.mailboxAccessSearch.set('');
  }

   updateMailboxAccessSearch(value: string): void {
    this.mailboxAccessSearch.set(value);
  }

   resetUserForm(): void {
    this.userEditorOpen.set(false);
    this.editingUserId.set('');
    this.userFormName.set('');
    this.userFormEmail.set('');
    this.userFormPassword.set('');
    this.userFormRole.set('user');
    this.userFormDelegatedMailboxes.set([]);
    this.mailboxAccessModalOpen.set(false);
    this.mailboxAccessSearch.set('');
    this.resetUsernameAvailability();
    this.clearUsersFeedback();
  }

   openNewUserModal(): void {
    this.editingUserId.set('');
    this.userFormName.set('');
    this.userFormEmail.set('');
    this.userFormPassword.set('');
    this.userFormRole.set('user');
    this.userFormDelegatedMailboxes.set([]);
    this.resetUsernameAvailability();
    this.clearUsersFeedback();
    this.userEditorOpen.set(true);
  }

   editPlatformUser(user: PlatformUser): void {
    this.editingUserId.set(user.id);
    this.userFormName.set(user.name);
    this.userFormEmail.set(user.email);
    this.userFormPassword.set('');
    this.userFormRole.set(user.role === 'admin' ? 'admin' : 'user');
    this.userFormDelegatedMailboxes.set(user.delegatedMailboxes || []);
    this.resetUsernameAvailability();
    this.clearUsersFeedback();
    this.userEditorOpen.set(true);
  }

   closeUserModal(): void {
    if (this.usersSaving()) {
      return;
    }

    this.resetUserForm();
  }

  async loadPlatformUsers(): Promise<void> {
    const token = this.authToken();

    if (!token || !this.canManageUsers()) {
      return;
    }

    this.usersLoading.set(true);
    this.usersError.set('');

    try {
      const response = await fetch(`${this.apiUrl}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        this.logout();
        this.errorMessage.set('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudieron cargar los usuarios' }));
        throw new Error(payload.message || 'No se pudieron cargar los usuarios');
      }

      this.platformUsers.set((await response.json()) as PlatformUser[]);
    } catch (error) {
      this.usersError.set(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios');
    } finally {
      this.usersLoading.set(false);
    }
  }

  async savePlatformUser(): Promise<void> {
    const token = this.authToken();

    if (!token || !this.canManageUsers()) {
      return;
    }

    const editingId = this.editingUserId();
    const previousEmail = this.platformUsers().find((user) => user.id === editingId)?.email || '';
    const endpoint = editingId ? `${this.apiUrl}/users/${editingId}` : `${this.apiUrl}/users`;

    if (!editingId) {
      const usernameIsAvailable = await this.ensureUsernameAvailable();
      if (!usernameIsAvailable) {
        return;
      }
    }

    const email = this.platformUserEmailForSave(editingId);

    this.usersSaving.set(true);
    this.clearUsersFeedback();

    try {
      const response = await fetch(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.userFormName().trim(),
          email,
          password: this.userFormPassword(),
          role: this.userFormRole(),
          delegatedMailboxes: this.userFormDelegatedMailboxes(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo guardar el usuario' }));
        throw new Error(payload.message || 'No se pudo guardar el usuario');
      }

      const savedUser = (await response.json()) as PlatformUser;
      this.platformUsers.set(this.mergePlatformUser(savedUser));
      this.syncCurrentUser(savedUser, previousEmail);
      this.resetUserForm();
      this.usersMessage.set(editingId ? 'Usuario actualizado' : 'Usuario creado');
    } catch (error) {
      this.usersError.set(error instanceof Error ? error.message : 'No se pudo guardar el usuario');
    } finally {
      this.usersSaving.set(false);
    }
  }

  async deletePlatformUser(user: PlatformUser): Promise<void> {
    const token = this.authToken();

    if (!token || !this.canManageUsers()) {
      return;
    }

    const confirmed = window.confirm(`Eliminar el usuario ${user.email}?`);
    if (!confirmed) {
      return;
    }

    this.usersDeletingId.set(user.id);
    this.clearUsersFeedback();

    try {
      const response = await fetch(`${this.apiUrl}/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo eliminar el usuario' }));
        throw new Error(payload.message || 'No se pudo eliminar el usuario');
      }

      this.platformUsers.set(this.platformUsers().filter((item) => item.id !== user.id));

      if (this.editingUserId() === user.id) {
        this.resetUserForm();
      }

      this.usersMessage.set('Usuario eliminado');
    } catch (error) {
      this.usersError.set(error instanceof Error ? error.message : 'No se pudo eliminar el usuario');
    } finally {
      this.usersDeletingId.set('');
    }
  }

   updateMailConfigEmail(value: string): void {
    this.mailConfigEmail.set(value);
    this.clearMailFeedback();
  }

   updateMailConfigPassword(value: string): void {
    this.mailConfigPassword.set(value);
    this.clearMailFeedback();
  }

   updateComposeTo(value: string): void {
    this.composeTo.set(value);
    this.clearMailFeedback();
  }

   updateComposeCc(value: string): void {
    this.composeCc.set(value);
    this.clearMailFeedback();
  }

   updateComposeBcc(value: string): void {
    this.composeBcc.set(value);
    this.clearMailFeedback();
  }

   updateComposeSubject(value: string): void {
    this.composeSubject.set(value);
    this.clearMailFeedback();
  }

   updateComposeBody(value: string): void {
    this.composeBody.set(value);
    this.clearMailFeedback();
  }

   updateComposeAttachments(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files || []);

    if (!files.length) {
      return;
    }

    const maxFileSize = 20 * 1024 * 1024;
    const validFiles = files.filter((file) => file.size <= maxFileSize);

    if (validFiles.length !== files.length) {
      this.mailError.set('Cada archivo debe pesar 20 MB o menos.');
    } else {
      this.clearMailFeedback();
    }

    this.composeAttachments.set([...this.composeAttachments(), ...validFiles].slice(0, 10));

    if (input) {
      input.value = '';
    }
  }

   removeComposeAttachment(index: number): void {
    this.composeAttachments.set(this.composeAttachments().filter((_, itemIndex) => itemIndex !== index));
    this.clearMailFeedback();
  }

   updateMailSearch(value: string): void {
    this.mailSearch.set(value);
  }

  async updateSelectedMailbox(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === this.selectedMailboxEmail()) {
      return;
    }

    this.selectedMailboxEmail.set(cleanEmail);
    this.selectedMailMessage.set(null);
    this.mailMessages.set([]);
    this.mailMessagesTotal.set(0);
    this.selectedMailBox.set('INBOX');
    await this.loadMailboxStatus();

    if (this.mailboxStatus()?.configured) {
      await this.loadMailMessages();
    }
  }

  async updateMailFolder(folderId: string): Promise<void> {
    const nextFolder = this.mailFolders.find((folder) => folder.id === folderId)?.id || 'INBOX';
    if (nextFolder === this.selectedMailBox()) {
      return;
    }

    this.selectedMailBox.set(nextFolder);
    this.selectedMailMessage.set(null);
    this.mailMessages.set([]);
    this.mailMessagesTotal.set(0);
    await this.loadMailMessages();
  }

  async initializeMailbox(): Promise<void> {
    await this.loadMailboxStatus();

    if (this.mailboxStatus()?.configured) {
      await this.loadMailMessages();
    }
  }

  async loadMailboxStatus(): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/status${this.mailboxQuery()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        this.logout();
        this.errorMessage.set('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo cargar el buzon' }));
        throw new Error(payload.message || 'No se pudo cargar el buzon');
      }

      const status = (await response.json()) as MailboxStatus;
      this.mailboxStatus.set(status);
      this.selectedMailboxEmail.set(status.selectedMailboxEmail || status.email || status.mailboxes?.[0]?.email || '');
      this.mailConfigEmail.set(status.email || '');
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudo cargar el buzon');
    }
  }

  async saveMailboxConfig(): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    this.mailConfiguring.set(true);
    this.clearMailFeedback();

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.mailConfigEmail().trim(),
          password: this.mailConfigPassword(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo configurar el buzon' }));
        throw new Error(payload.message || 'No se pudo configurar el buzon');
      }

      const status = (await response.json()) as MailboxStatus;
      this.mailboxStatus.set(status);
      this.selectedMailboxEmail.set(status.selectedMailboxEmail || status.email || '');
      this.mailConfigPassword.set('');
      this.mailMessage.set('Buzon configurado');
      await this.loadMailMessages();
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudo configurar el buzon');
    } finally {
      this.mailConfiguring.set(false);
    }
  }

  async loadMailMessages(): Promise<void> {
    const token = this.authToken();

    if (!token || !this.mailboxStatus()?.configured) {
      return;
    }

    this.mailboxLoading.set(true);
    this.mailError.set('');

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/messages${this.mailboxQuery({ limit: '50' })}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        this.logout();
        this.errorMessage.set('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudieron cargar los correos' }));
        throw new Error(payload.message || 'No se pudieron cargar los correos');
      }

      const payload = (await response.json()) as MailMessageListResponse;
      this.mailMessages.set(payload.messages || []);
      this.mailMessagesTotal.set(payload.total || 0);
      this.selectedMailBox.set(payload.box || this.selectedMailBox());
      this.selectedMailboxEmail.set(payload.mailboxEmail || this.selectedMailboxEmail());
      this.selectedMailMessage.set(null);
      await this.loadMailboxStatus();
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudieron cargar los correos');
    } finally {
      this.mailboxLoading.set(false);
    }
  }

  async openMailMessage(message: MailMessageSummary): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    this.mailReading.set(true);
    this.mailError.set('');

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/messages/${message.uid}${this.mailboxQuery()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo abrir el correo' }));
        throw new Error(payload.message || 'No se pudo abrir el correo');
      }

      const detail = (await response.json()) as MailMessageDetail;
      this.selectedMailMessage.set(detail);

      if (message.unread) {
        await fetch(`${this.apiUrl}/mailbox/messages/${message.uid}/read${this.mailboxQuery()}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
        this.mailMessages.set(
          this.mailMessages().map((item) =>
            item.uid === message.uid ? { ...item, unread: false } : item,
          ),
        );
        const status = this.mailboxStatus();
        if (status) {
          this.mailboxStatus.set({ ...status, unseen: Math.max(0, status.unseen - 1) });
        }
      }
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudo abrir el correo');
    } finally {
      this.mailReading.set(false);
    }
  }

   openCompose(): void {
    if (!this.mailboxStatus()?.configured) {
      this.mailError.set('No hay buzon disponible para enviar correos.');
      return;
    }

    this.composeOpen.set(true);
    this.clearMailFeedback();
  }

   toggleMailSelectionMode(): void {
    this.mailSelectionMode.set(!this.mailSelectionMode());
  }

   toggleMailThreads(): void {
    this.mailThreadsEnabled.set(!this.mailThreadsEnabled());
  }

   showMailOption(label: string): void {
    this.mailMessage.set(`${label} disponible en la barra de correos.`);
    this.mailError.set('');
  }

   closeCompose(): void {
    if (this.mailSending()) {
      return;
    }

    this.composeOpen.set(false);
    this.composeTo.set('');
    this.composeCc.set('');
    this.composeBcc.set('');
    this.composeSubject.set('');
    this.composeBody.set('');
    this.composeAttachments.set([]);
    this.clearMailFeedback();
  }

   replyToSelected(): void {
    const selected = this.selectedMailMessage();
    if (!selected) {
      return;
    }

    this.composeTo.set(selected.from[0]?.address || '');
    this.composeSubject.set(selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`);
    this.composeBody.set(`\n\n---\n${selected.text || ''}`.trimStart());
    this.composeOpen.set(true);
    this.clearMailFeedback();
  }

   replyAllToSelected(): void {
    const selected = this.selectedMailMessage();
    if (!selected) {
      return;
    }

    const currentMailbox = this.selectedMailboxEmail().toLowerCase();
    const recipients = [...selected.from, ...selected.to, ...selected.cc]
      .map((address) => address.address || address.name)
      .filter(Boolean)
      .filter((address, index, list) => {
        const normalized = address.toLowerCase();
        return normalized !== currentMailbox && list.findIndex((item) => item.toLowerCase() === normalized) === index;
      });

    this.composeTo.set(recipients.join(', '));
    this.composeSubject.set(selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`);
    this.composeBody.set(`\n\n---\n${selected.text || ''}`.trimStart());
    this.composeOpen.set(true);
    this.clearMailFeedback();
  }

   forwardSelected(): void {
    const selected = this.selectedMailMessage();
    if (!selected) {
      return;
    }

    this.composeTo.set('');
    this.composeSubject.set(selected.subject.toLowerCase().startsWith('fwd:') ? selected.subject : `Fwd: ${selected.subject}`);
    this.composeBody.set(`\n\n--- Mensaje reenviado ---\nDe: ${this.mailAddressLine(selected.from)}\nPara: ${this.mailAddressLine(selected.to)}\nFecha: ${this.formatMailDate(selected.date)}\nAsunto: ${this.mailSubject(selected)}\n\n${selected.text || ''}`.trimStart());
    this.composeOpen.set(true);
    this.clearMailFeedback();
  }

  async moveSelectedMail(targetBox: string, label: string): Promise<void> {
    const token = this.authToken();
    const selected = this.selectedMailMessage();

    if (!token || !selected) {
      return;
    }

    this.mailReading.set(true);
    this.clearMailFeedback();

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/messages/${selected.uid}/move${this.mailboxQuery()}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetBox }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: `No se pudo mover a ${label}` }));
        throw new Error(payload.message || `No se pudo mover a ${label}`);
      }

      this.mailMessages.set(this.mailMessages().filter((message) => message.uid !== selected.uid));
      this.mailMessagesTotal.set(Math.max(0, this.mailMessagesTotal() - 1));
      this.selectedMailMessage.set(null);
      this.mailMessage.set(`Correo movido a ${label}`);
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : `No se pudo mover a ${label}`);
    } finally {
      this.mailReading.set(false);
    }
  }

  async toggleSelectedMailReadState(): Promise<void> {
    const token = this.authToken();
    const selected = this.selectedMailMessage();

    if (!token || !selected) {
      return;
    }

    const read = selected.unread;
    this.clearMailFeedback();

    try {
      const response = await fetch(`${this.apiUrl}/mailbox/messages/${selected.uid}/read-state${this.mailboxQuery()}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo marcar el correo' }));
        throw new Error(payload.message || 'No se pudo marcar el correo');
      }

      const nextSelected = { ...selected, unread: !read };
      this.selectedMailMessage.set(nextSelected);
      this.mailMessages.set(
        this.mailMessages().map((message) =>
          message.uid === selected.uid ? { ...message, unread: !read } : message,
        ),
      );
      this.mailMessage.set(read ? 'Correo marcado como leido' : 'Correo marcado como no leido');
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudo marcar el correo');
    }
  }

   mailFolderBadge(folderId: string): string {
    if (folderId === 'INBOX') {
      const unseen = this.mailboxStatus()?.unseen || 0;
      return unseen > 0 ? String(unseen) : '';
    }

    if (folderId === this.selectedMailBox() && this.mailMessagesTotal() > 0) {
      return String(this.mailMessagesTotal());
    }

    return '';
  }

  async sendMail(): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    this.mailSending.set(true);
    this.clearMailFeedback();

    try {
      const formData = new FormData();
      formData.append('to', this.composeTo().trim());
      formData.append('mailboxEmail', this.selectedMailboxEmail());
      formData.append('cc', this.composeCc().trim());
      formData.append('bcc', this.composeBcc().trim());
      formData.append('subject', this.composeSubject().trim());
      formData.append('text', this.composeBody());

      for (const file of this.composeAttachments()) {
        formData.append('attachments', file, file.name);
      }

      const response = await fetch(`${this.apiUrl}/mailbox/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No se pudo enviar el correo' }));
        throw new Error(payload.message || 'No se pudo enviar el correo');
      }

      this.closeCompose();
      this.mailMessage.set('Correo enviado');
    } catch (error) {
      this.mailError.set(error instanceof Error ? error.message : 'No se pudo enviar el correo');
    } finally {
      this.mailSending.set(false);
    }
  }

   mailAddressLine(addresses: MailAddress[]): string {
    return addresses
      .map((address) => address.name || address.address)
      .filter(Boolean)
      .join(', ');
  }

   mailSenderName(addresses: MailAddress[]): string {
    return this.mailAddressLine(addresses) || 'Remitente desconocido';
  }

   mailSenderInitial(addresses: MailAddress[]): string {
    const sender = this.mailSenderName(addresses).trim();
    return (sender[0] || 'C').toUpperCase();
  }

   mailSubject(message: Pick<MailMessageSummary, 'subject'>): string {
    return message.subject?.trim() || '(sin asunto)';
  }

   mailRowPreview(message: MailMessageSummary): string {
    return message.unread ? 'Sin leer' : 'Leido';
  }

   userInitials(): string {
    const currentUser = this.user();
    const value = currentUser?.name || currentUser?.email || 'MI';
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'MI';
  }

   formatMailDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isSameYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('es-DO', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'short',
      ...(isSameYear ? {} : { year: 'numeric' }),
    });
  }

   formatAttachmentSize(size: number): string {
    if (!Number.isFinite(size) || size <= 0) {
      return '0 KB';
    }

    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

   formatUserDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  async saveProfile(): Promise<void> {
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

  async submitAuth(): Promise<void> {
    if (this.authMode() === 'register') {
      await this.register();
      return;
    }

    await this.login();
  }

  async login(): Promise<void> {
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
      await this.loadAdminUserSummary();
      await this.loadExternalUserStatuses();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
    } finally {
      this.isLoading.set(false);
    }
  }

  async register(): Promise<void> {
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
      await this.loadAdminUserSummary();
      await this.loadExternalUserStatuses();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo registrar');
    } finally {
      this.isLoading.set(false);
    }
  }

   logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.authToken.set(null);
    this.user.set(null);
    this.apps.set([]);
    this.platformUsers.set([]);
    this.mailboxStatus.set(null);
    this.selectedMailboxEmail.set('');
    this.selectedMailBox.set('INBOX');
    this.mailMessages.set([]);
    this.mailMessagesTotal.set(0);
    this.selectedMailMessage.set(null);
    this.mailConfigEmail.set('');
    this.mailConfigPassword.set('');
    this.closeCompose();
    this.clearMailFeedback();
    this.montaoGpsUserExists.set(false);
    this.montaoRentUserExists.set(false);
    this.montaoCrmUserExists.set(false);
    this.montaoAdminUserExists.set(false);
    this.password.set('');
    this.profileName.set('');
    this.profileEmail.set('');
    this.profilePassword.set('');
    this.profilePasswordConfirm.set('');
    this.profileMessage.set('');
    this.resetUserForm();
    this.usersMessage.set('');
    this.usersError.set('');
  }

   isMontaoGpsApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('gps');
  }

   isMontaoRentApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('rent');
  }

   isMontaoCrmApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('crm');
  }

   isMontaoMarketplaceApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('marketplace');
  }

   isMontaoTalleresApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('taller');
  }

   isMontaoMetricasApp(app: CompanyApp): boolean {
    return app.name.toLowerCase().includes('metrica');
  }

   isVerifiedLink(link: AppNodeLink): boolean {
    return (
      (link.isMontaoGpsConnection && this.montaoGpsUserExists()) ||
      (link.isMontaoRentConnection && this.montaoRentUserExists()) ||
      (link.isMontaoCrmConnection && this.montaoCrmUserExists()) ||
      (link.isMontaoAdminConnection && this.montaoAdminUserExists()) ||
      (link.isMontaoGpsRentConnection && this.montaoGpsUserExists() && this.montaoRentUserExists()) ||
      (link.isMontaoCrmRentConnection && this.montaoCrmUserExists() && this.montaoRentUserExists())
    );
  }

   isConnectedApp(app: CompanyApp): boolean {
    if (this.isMontaoGpsApp(app)) {
      return this.montaoGpsUserExists();
    }

    if (this.isMontaoRentApp(app)) {
      return this.montaoRentUserExists();
    }

    if (this.isMontaoCrmApp(app)) {
      return this.montaoCrmUserExists();
    }

    if (this.isMontaoMarketplaceApp(app)) {
      return this.montaoAdminUserExists();
    }

    return false;
  }

   displayAppName(app: CompanyApp): string {
    return this.isMontaoGpsApp(app) ? 'Montao GPS' : app.name;
  }

   appLogoUrl(app: CompanyApp): string {
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

    if (appName.includes('marketplace')) {
      return '/logo.png';
    }

    if (appName.includes('repuesto')) {
      return '/logo.png';
    }

    if (appName.includes('dealer')) {
      return '/logodealers.svg';
    }

    if (appName.includes('drive')) {
      return '/logodrive.svg';
    }

    if (this.isMontaoTalleresApp(app)) {
      return '/logotaller.png';
    }

    return '';
  }

  async openApp(app: CompanyApp, event: Event): Promise<void> {
    if (!this.isConnectedApp(app)) {
      event.preventDefault();
      return;
    }

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
    return (
      this.isMontaoGpsApp(app) ||
      this.isMontaoRentApp(app) ||
      this.isMontaoCrmApp(app) ||
      this.isMontaoMarketplaceApp(app)
    );
  }

  private ssoPathForApp(app: CompanyApp): string {
    if (this.isMontaoRentApp(app)) {
      return 'montao-rent';
    }

    if (this.isMontaoCrmApp(app)) {
      return 'montao-crm';
    }

    if (this.isMontaoMarketplaceApp(app)) {
      return 'montao-admin';
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

  private async initializeSession(): Promise<void> {
    await this.refreshSession();
    await this.loadDashboardData();
    await this.loadAdminUserSummary();
    window.setTimeout(() => void this.loadExternalUserStatuses(), 500);
  }

  private async refreshSession(): Promise<void> {
    const token = this.authToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        this.logout();
        this.errorMessage.set('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      if (!response.ok) {
        return;
      }

      this.setSession((await response.json()) as LoginResponse);
    } catch {
      return;
    }
  }

  private mergePlatformUser(savedUser: PlatformUser): PlatformUser[] {
    const users = this.platformUsers();
    const existingIndex = users.findIndex((user) => user.id === savedUser.id);
    const nextUsers =
      existingIndex >= 0
        ? users.map((user) => (user.id === savedUser.id ? savedUser : user))
        : [...users, savedUser];

    return nextUsers.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  }

  private syncCurrentUser(savedUser: PlatformUser, previousEmail: string): void {
    const currentUser = this.user();
    if (!currentUser) {
      return;
    }

    const isCurrentUser =
      (currentUser.id && currentUser.id === savedUser.id) ||
      currentUser.email.toLowerCase() === previousEmail.toLowerCase();

    if (!isCurrentUser) {
      return;
    }

    const nextUser: AuthUser = {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      role: savedUser.role,
    };

    localStorage.setItem(this.userKey, JSON.stringify(nextUser));
    this.user.set(nextUser);
    this.profileName.set(nextUser.name);
    this.profileEmail.set(nextUser.email);
  }

  private clearUsersFeedback(): void {
    this.usersMessage.set('');
    this.usersError.set('');
  }

  private clearMailFeedback(): void {
    this.mailMessage.set('');
    this.mailError.set('');
  }

  private mailboxQuery(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams(extra);
    const selected = this.selectedMailboxEmail();
    if (selected) {
      params.set('mailboxEmail', selected);
    }

    const box = this.selectedMailBox();
    if (box) {
      params.set('box', box);
    }

    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private scheduleUsernameAvailabilityCheck(): void {
    if (this.usernameAvailabilityTimer) {
      clearTimeout(this.usernameAvailabilityTimer);
    }

    const username = this.cleanUsername(this.userFormEmail());
    if (!username) {
      this.resetUsernameAvailability();
      return;
    }

    const email = `${username}${this.userEmailDomain}`;
    if (this.platformUsers().some((user) => user.email.toLowerCase() === email)) {
      this.usernameAvailabilityStatus.set('taken');
      this.usernameAvailabilityEmail.set(email);
      this.usernameAvailabilityMessage.set(`${email} no esta disponible`);
      return;
    }

    this.usernameAvailabilityStatus.set('checking');
    this.usernameAvailabilityEmail.set(email);
    this.usernameAvailabilityMessage.set(`Verificando ${email}...`);

    this.usernameAvailabilityTimer = setTimeout(() => {
      void this.checkUsernameAvailability(username);
    }, 350);
  }

  private async ensureUsernameAvailable(): Promise<boolean> {
    const username = this.cleanUsername(this.userFormEmail());

    if (!username) {
      this.usersError.set('Escribe un nombre de usuario');
      this.resetUsernameAvailability();
      return false;
    }

    const email = `${username}${this.userEmailDomain}`;
    if (
      this.usernameAvailabilityStatus() === 'available' &&
      this.usernameAvailabilityEmail() === email
    ) {
      return true;
    }

    if (
      this.usernameAvailabilityStatus() === 'taken' &&
      this.usernameAvailabilityEmail() === email
    ) {
      this.usersError.set(`${email} no esta disponible`);
      return false;
    }

    return this.checkUsernameAvailability(username);
  }

  private async checkUsernameAvailability(username: string): Promise<boolean> {
    const token = this.authToken();
    const cleanUsername = this.cleanUsername(username);
    const email = `${cleanUsername}${this.userEmailDomain}`;
    const requestId = ++this.usernameAvailabilityRequestId;

    if (!token || !cleanUsername || this.editingUserId()) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/users/availability?username=${encodeURIComponent(cleanUsername)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (
        requestId !== this.usernameAvailabilityRequestId ||
        cleanUsername !== this.cleanUsername(this.userFormEmail()) ||
        this.editingUserId()
      ) {
        return false;
      }

      if (!response.ok) {
        throw new Error('No se pudo validar la disponibilidad');
      }

      const payload = (await response.json()) as { available?: boolean; email?: string };
      const checkedEmail = String(payload.email || email).toLowerCase();

      this.usernameAvailabilityEmail.set(checkedEmail);

      if (payload.available === true) {
        this.usernameAvailabilityStatus.set('available');
        this.usernameAvailabilityMessage.set(`${checkedEmail} esta disponible`);
        return true;
      }

      this.usernameAvailabilityStatus.set('taken');
      this.usernameAvailabilityMessage.set(`${checkedEmail} no esta disponible`);
      return false;
    } catch {
      if (requestId === this.usernameAvailabilityRequestId) {
        this.usernameAvailabilityStatus.set('error');
        this.usernameAvailabilityEmail.set(email);
        this.usernameAvailabilityMessage.set('No se pudo validar disponibilidad');
      }

      return false;
    }
  }

  private resetUsernameAvailability(): void {
    if (this.usernameAvailabilityTimer) {
      clearTimeout(this.usernameAvailabilityTimer);
      this.usernameAvailabilityTimer = null;
    }

    this.usernameAvailabilityRequestId += 1;
    this.usernameAvailabilityStatus.set('idle');
    this.usernameAvailabilityEmail.set('');
    this.usernameAvailabilityMessage.set('');
  }

  private platformUserEmailForSave(editingId: string): string {
    if (editingId) {
      return this.userFormEmail().trim();
    }

    const username = this.cleanUsername(this.userFormEmail());
    return username ? `${username}${this.userEmailDomain}` : '';
  }

  private cleanUsername(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/@.*$/, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._-]/g, '');
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

  private async loadAdminUserSummary(): Promise<void> {
    if (!this.canManageUsers()) {
      this.platformUsers.set([]);
      return;
    }

    await this.loadPlatformUsers();
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
      isMontaoAdminConnection: false,
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

  private nodeAngle(node: AppNode): number {
    return Math.atan2(node.y - 50, node.x - 50);
  }

  private async loadExternalUserStatuses(): Promise<void> {
    await Promise.all([
      this.loadMontaoGpsUserStatus(),
      this.loadMontaoRentUserStatus(),
      this.loadMontaoCrmUserStatus(),
      this.loadMontaoAdminUserStatus(),
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

  private async loadMontaoAdminUserStatus(): Promise<void> {
    const token = this.authToken();
    if (!token) {
      this.montaoAdminUserExists.set(false);
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sso/montao-admin/user-exists`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        this.montaoAdminUserExists.set(false);
        return;
      }

      const payload = (await response.json()) as { exists?: boolean };
      this.montaoAdminUserExists.set(payload.exists === true);
    } catch {
      this.montaoAdminUserExists.set(false);
    }
  }
}
