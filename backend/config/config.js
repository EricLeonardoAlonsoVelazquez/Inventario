require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
    secret: process.env.JWT_SECRET || 'bdadbf29ff462ca7e0844818d628d547f019ba1590a87ddf167e4e053802815c2e19f982f68c07faaa902eda08dc301b4e6e57bfdf30f3b9d672c804d95d082e',
    expiresIn: '7d'
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID
  },
  
  cors: {
    origins: ['http://localhost:3000', 'http://127.0.0.1:5500']
  }
};

if (!config.jwt.secret || config.jwt.secret === 'bdadbf29ff462ca7e0844818d628d547f019ba1590a87ddf167e4e053802815c2e19f982f68c07faaa902eda08dc301b4e6e57bfdf30f3b9d672c804d95d082e') {
  console.warn('⚠️  ADVERTENCIA: Usando JWT secret por defecto. En producción, establece JWT_SECRET en .env');
}

if (config.nodeEnv === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET es requerido en producción');
  process.exit(1);
}

module.exports = config;