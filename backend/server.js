const path = require('node:path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || 'montao_index_local_secret';

app.use(cors({ origin: ['http://localhost:4201', 'http://127.0.0.1:4201'] }));
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'admin' },
  },
  { timestamps: true },
);

const appSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    group: { type: String, required: true },
    owner: { type: String, required: true },
    url: { type: String, required: true },
    status: { type: String, enum: ['Online', 'Revision', 'Interna'], default: 'Online' },
    initials: { type: String, required: true },
    icon: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);
const CompanyApp = mongoose.model('CompanyApp', appSchema);

const defaultApps = [
  {
    name: 'Montao CRM',
    description: 'Gestion comercial, clientes, visitas, oportunidades y reportes de venta.',
    category: 'Ventas',
    group: 'Productividad',
    owner: 'Equipo Comercial',
    url: 'http://localhost:4200',
    status: 'Online',
    initials: 'CRM',
    icon: '▦',
    order: 1,
  },
  {
    name: 'Montao Rent',
    description: 'Contratos, vehiculos, mantenimientos, seguros y control de alquileres.',
    category: 'Operaciones',
    group: 'Operaciones',
    owner: 'Renta y Flota',
    url: 'http://localhost:4300',
    status: 'Revision',
    initials: 'MR',
    icon: '▣',
    order: 2,
  },
  {
    name: 'GPS Mobile',
    description: 'Instalaciones, inventario, rutas, vehiculos y seguimiento tecnico.',
    category: 'Tecnologia',
    group: 'Operaciones',
    owner: 'Soporte GPS',
    url: 'http://localhost:8100',
    status: 'Online',
    initials: 'GPS',
    icon: '⌁',
    order: 3,
  },
  {
    name: 'Montao Metricas',
    description: 'Panel ejecutivo para indicadores, visitas, ventas y rendimiento por gestor.',
    category: 'Analitica',
    group: 'Finanzas y Analitica',
    owner: 'Direccion',
    url: 'http://localhost:8080',
    status: 'Online',
    initials: 'MT',
    icon: '▥',
    order: 4,
  },
  {
    name: 'Facturacion INCOSIS',
    description: 'Facturas, comprobantes, clientes, productos y resumen financiero.',
    category: 'Finanzas',
    group: 'Finanzas y Analitica',
    owner: 'Administracion',
    url: 'http://localhost:4400',
    status: 'Interna',
    initials: 'FI',
    icon: '▤',
    order: 5,
  },
];

async function prepareUsersCollection() {
  await User.collection.dropIndex('username_1').catch(() => {});

  const legacyUsers = await User.collection.find({ email: { $exists: false } }).toArray();
  for (const legacyUser of legacyUsers) {
    const username = String(legacyUser.username || legacyUser._id).trim().toLowerCase();
    const email = username.includes('@') ? username : `${username}@montao.local`;
    await User.collection.updateOne({ _id: legacyUser._id }, { $set: { email } });
  }
}

async function seedDatabase() {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'super_admin@montao.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    await User.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: 'Super Admin',
      role: 'admin',
    });
  }

  const appCount = await CompanyApp.countDocuments();
  if (appCount === 0) {
    await CompanyApp.insertMany(defaultApps);
  }
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Sesion invalida' });
  }
}

function createSession(user) {
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret, {
    expiresIn: '12h',
  });

  return {
    token,
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'pending' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanName || !cleanEmail || !cleanPassword) {
    return res.status(400).json({ message: 'Nombre, correo y contrasena son requeridos' });
  }

  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ message: 'El correo no es valido' });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({ message: 'La contrasena debe tener al menos 6 caracteres' });
  }

  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser) {
    return res.status(409).json({ message: 'Ese correo ya esta registrado' });
  }

  const user = await User.create({
    email: cleanEmail,
    passwordHash: await bcrypt.hash(cleanPassword, 12),
    name: cleanName,
    role: 'user',
  });

  return res.status(201).json(createSession(user));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail || !password) {
    return res.status(400).json({ message: 'Correo y contrasena son requeridos' });
  }

  const user = await User.findOne({ email: cleanEmail });
  const passwordMatches = user ? await bcrypt.compare(String(password), user.passwordHash) : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({ message: 'Credenciales invalidas' });
  }

  return res.json(createSession(user));
});

app.get('/api/apps', authenticate, async (req, res) => {
  const apps = await CompanyApp.find().sort({ order: 1, name: 1 }).lean();
  res.json(apps);
});

app.post('/api/sso/montao-gps', authenticate, async (req, res) => {
  const user = await User.findById(req.user.sub).lean();

  if (!user?.email) {
    return res.status(400).json({
      message: 'Este usuario no tiene correo configurado en Montao Index.',
    });
  }

  const gpsApiUrl = process.env.MONTAO_GPS_API_URL || 'https://tracker-back.dorhu.com';
  const gpsFrontendUrl = process.env.MONTAO_GPS_FRONTEND_URL || 'https://tracker.montao.net';
  const ssoSecret =
    process.env.MONTAO_INDEX_SSO_SECRET ||
    process.env.MONTAO_GPS_SSO_SECRET ||
    'montao_index_sso_dev_secret';

  const response = await fetch(`${gpsApiUrl}/auth/sso/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-montao-index-sso-secret': ssoSecret,
    },
    body: JSON.stringify({
      email: user.email,
      name: user?.name,
      source: 'montao_index',
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'No se pudo iniciar SSO' }));
    return res.status(response.status).json({
      message: payload.message || 'No se pudo iniciar SSO con Montao GPS',
    });
  }

  const payload = await response.json();
  const gpsUser = encodeURIComponent(JSON.stringify(payload.user || {}));
  const token = encodeURIComponent(payload.access_token);
  const sessionDate = payload.session_date
    ? `&session_date=${encodeURIComponent(payload.session_date)}`
    : '';

  return res.json({
    redirectUrl: `${gpsFrontendUrl}/auth/sso?token=${token}&user=${gpsUser}${sessionDate}`,
  });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await prepareUsersCollection();
  await seedDatabase();

  app.listen(port, () => {
    console.log(`Montao Index API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('No se pudo iniciar Montao Index API');
  console.error(error.message);
  process.exit(1);
});
