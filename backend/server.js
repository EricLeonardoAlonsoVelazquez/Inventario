const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const allRoutes = require('./routes/auth');
const path = require('path');
const config = require('./config/config');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost', 'http://localhost:80', 'http://frontend', 'http://localhost:3000'],
  credentials: true
}));
app.use(cookieParser()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos SIN middleware de autenticación
app.use(express.static(path.join(__dirname, '../frontend')));

// 🔥 LOGIN como página principal
app.get('/', (req, res) => {
  console.log('🏠 Sirviendo página de login como principal');
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Ruta login
app.get('/login', (req, res) => {
  console.log('🔑 Sirviendo página de login');
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// 🔥 IMPORTANTE: Middleware SOLO para ruta /inventario
app.get('/inventario', async (req, res, next) => {
  console.log('🔍 Verificando acceso a /inventario...');
  
  // Extraer token
  const token = req.headers.authorization?.replace('Bearer ', '') || 
               req.cookies?.authToken;
  
  if (!token) {
    console.log('❌ No hay token, redirigiendo a login');
    return res.redirect('/');
  }
  
  try {
    // Verificar token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const { db } = require('./config/firebase');
    const usersRef = db.collection('usuarios');
    const snapshot = await usersRef.where('email', '==', decoded.email).limit(1).get();
    
    if (snapshot.empty) {
      console.log('❌ Usuario no encontrado');
      return res.redirect('/');
    }
    
    console.log('✅ Usuario autenticado para inventario:', decoded.email);
    
    // Servir el archivo HTML
    return res.sendFile(path.join(__dirname, '../frontend', 'inventario.html'));
  } catch (error) {
    console.log('❌ Token inválido:', error.message);
    return res.redirect('/');
  }
});

// 🔥 Ruta específica para inventario.html
app.get('/inventario.html', async (req, res) => {
  console.log('📄 Acceso directo a inventario.html');
  res.redirect('/inventario');
});

// Todas las rutas API (estas usan el middleware de autenticación en routes/all.js)
app.use('/api', allRoutes);

// Ruta de salud pública
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('💥 Error no manejado:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor' 
  });
});

// 404 handler - Redirigir a login
app.use('*', (req, res) => {
  console.log('404: Ruta no encontrada:', req.originalUrl);
  
  // Si es una petición de API, devolver JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false, 
      message: 'Ruta API no encontrada' 
    });
  }
  
  // Si es un archivo estático, intentar servirlo
  if (req.originalUrl.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return res.status(404).send('Archivo no encontrado');
  }
  
  // Para cualquier otra ruta, redirigir a login
  res.redirect('/');
});

// Iniciar servidor
app.listen(config.port, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${config.port}`);
  console.log(`🏠 Página principal (LOGIN): http://localhost:${config.port}/`);
  console.log(`📦 Inventario: http://localhost:${config.port}/inventario (PROTEGIDA)`);
  console.log('🔥 Firebase conectado correctamente');
  console.log('🛡️ Sistema de autenticación e inventario listo');
});