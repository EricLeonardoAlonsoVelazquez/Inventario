const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { db } = require('../config/firebase');

// Extraer token de diferentes fuentes
const extractToken = (req) => {
  // De headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  
  // De cookies
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  
  // De query string
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  return null;
};

// Verificar token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

// Verificar autenticación
const verifyAuthentication = async (token) => {
  if (!token) return { authenticated: false, user: null };
  
  try {
    const decoded = verifyToken(token);
    
    // Buscar usuario en Firebase
    const usersRef = db.collection('usuarios');
    const snapshot = await usersRef.where('email', '==', decoded.email).limit(1).get();
    
    if (snapshot.empty) {
      return { authenticated: false, user: null };
    }
    
    let user = null;
    snapshot.forEach(doc => {
      user = { id: doc.id, ...doc.data() };
    });
    
    return { authenticated: true, user };
  } catch (error) {
    console.log('❌ Error verificando token:', error.message);
    return { authenticated: false, user: null };
  }
};

// Middleware para rutas protegidas
const authenticateToken = async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado'
    });
  }
  
  try {
    const authResult = await verifyAuthentication(token);
    
    if (!authResult.authenticated) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }
    
    req.user = authResult.user;
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(401).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

// Generar token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Establecer cookie de autenticación
const setAuthCookie = (res, token) => {
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  });
};

// Limpiar cookie de autenticación
const clearAuthCookie = (res) => {
  res.clearCookie('authToken');
};

module.exports = {
  extractToken,
  verifyToken,
  verifyAuthentication,
  authenticateToken,
  generateToken,
  setAuthCookie,
  clearAuthCookie
};