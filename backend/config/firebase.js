const admin = require('firebase-admin');

const firebaseConfig = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com"
};

// Validar que todas las variables necesarias estén presentes
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ ERROR: Faltan variables de entorno de Firebase:', missingVars);
  
  // En desarrollo, puedes cargar desde archivo si existe
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Intentando cargar desde archivo local...');
    try {
      const path = require('path');
      const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
      
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
        console.log('🔥 Firebase inicializado desde archivo local');
      }
    } catch (error) {
      console.error('❌ No se pudo inicializar Firebase:', error.message);
    }
  }
} else {
  // Inicializar con variables de entorno
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        databaseURL: `https://${firebaseConfig.project_id}.firebaseio.com`
      });
      console.log('🔥 Firebase inicializado desde variables de entorno');
    }
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
  }
}

const db = admin.firestore();

// Función para probar conexión
async function testFirestoreConnection() {
  try {
    console.log('🔍 Probando conexión a Firestore...');
    
    // Solo probar si Firebase se inicializó correctamente
    if (db) {
      const testRef = db.collection('_test_connection');
      await testRef.doc('test').set({ 
        timestamp: new Date(),
        message: 'Conexión exitosa',
        environment: process.env.NODE_ENV || 'development'
      });
      
      await testRef.doc('test').delete();
      console.log('✅ Conexión a Firestore exitosa');
    }
  } catch (error) {
    console.error('❌ Error conectando a Firestore:', error.message);
  }
}

// Solo probar en entornos no productivos para evitar cargas innecesarias
if (process.env.NODE_ENV !== 'production') {
  testFirestoreConnection();
}

module.exports = { admin, db };