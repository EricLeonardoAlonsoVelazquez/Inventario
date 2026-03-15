const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { db } = require('../config/firebase');

// ==================== FUNCIONES DE AYUDA ====================
const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  return null;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

const verifyAuthentication = async (token) => {
  if (!token) return { authenticated: false, user: null };
  
  try {
    const decoded = verifyToken(token);
    
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
    return { authenticated: false, user: null };
  }
};

const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const setAuthCookie = (res, token) => {
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

// ==================== MIDDLEWARE DE AUTENTICACIÓN ====================
const authenticate = async (req, res, next) => {
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
    return res.status(401).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

// ==================== RUTAS DE AUTENTICACIÓN ====================

router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    const usersRef = db.collection('usuarios');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (!snapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya existe'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario en Firebase
    const userData = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userRef = await usersRef.add(userData);
    const userId = userRef.id;

    // Generar token JWT
    const token = generateToken(userId, email);

    // Establecer cookie
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        name,
        email
      },
      token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Login de usuario
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const usersRef = db.collection('usuarios');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    let userData = null;
    let userId = null;
    
    snapshot.forEach(doc => {
      userId = doc.id;
      userData = doc.data();
    });

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, userData.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(userId, email);

    // Establecer cookie
    setAuthCookie(res, token);

    // Actualizar último acceso
    await db.collection('usuarios').doc(userId).update({
      lastAccess: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: userId,
        name: userData.name,
        email: userData.email
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Verificar token
router.get('/auth/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// Logout
router.post('/auth/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
});

// ==================== RUTAS DE INVENTARIO (PROTEGIDAS) ====================

// 🛠️ HERRAMIENTAS CNC

// Obtener todas las herramientas del usuario
router.get('/inventario/herramientas', authenticate, async (req, res) => {
  try {
    const herramientasRef = db.collection('herramientas');
    const snapshot = await herramientasRef.where('usuarioId', '==', req.user.id).get();
    
    const herramientas = [];
    snapshot.forEach(doc => {
      herramientas.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      data: herramientas,
      message: 'Herramientas obtenidas correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo herramientas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener herramientas'
    });
  }
});

// Crear nueva herramienta
router.post('/inventario/herramientas', authenticate, async (req, res) => {
  try {
    const nuevaHerramienta = req.body;
    
    if (!nuevaHerramienta.codigo || !nuevaHerramienta.descripcion || !nuevaHerramienta.tipo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos (código, descripción, tipo)'
      });
    }
    
    const herramienta = {
      codigo: nuevaHerramienta.codigo,
      descripcion: nuevaHerramienta.descripcion,
      tipo: nuevaHerramienta.tipo,
      diametro: parseFloat(nuevaHerramienta.diametro) || 0,
      material: nuevaHerramienta.material || '',
      stock: parseInt(nuevaHerramienta.stock) || 0,
      stock_minimo: parseInt(nuevaHerramienta.stock_minimo) || 3,
      ubicacion: nuevaHerramienta.ubicacion || '',
      maquina: nuevaHerramienta.maquina || '',
      notas: nuevaHerramienta.notas || '',
      usuarioId: req.user.id,
      fecha_creacion: new Date().toISOString(),
      ultima_actualizacion: new Date().toISOString()
    };
    
    const docRef = await db.collection('herramientas').add(herramienta);
    
    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...herramienta },
      message: 'Herramienta creada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando herramienta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear herramienta'
    });
  }
});

// Actualizar herramienta
router.put('/inventario/herramientas/:id', authenticate, async (req, res) => {
  try {
    const herramientaId = req.params.id;
    const datosActualizados = req.body;
    
    const herramientaRef = db.collection('herramientas').doc(herramientaId);
    const doc = await herramientaRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Herramienta no encontrada'
      });
    }
    
    const herramientaActual = doc.data();
    
    if (herramientaActual.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para modificar esta herramienta'
      });
    }
    
    const herramientaActualizada = {
      ...herramientaActual,
      ...datosActualizados,
      ultima_actualizacion: new Date().toISOString()
    };
    
    await herramientaRef.update(herramientaActualizada);
    
    res.json({
      success: true,
      data: { id: herramientaId, ...herramientaActualizada },
      message: 'Herramienta actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando herramienta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar herramienta'
    });
  }
});

// Eliminar herramienta
router.delete('/inventario/herramientas/:id', authenticate, async (req, res) => {
  try {
    const herramientaId = req.params.id;
    
    const herramientaRef = db.collection('herramientas').doc(herramientaId);
    const doc = await herramientaRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Herramienta no encontrada'
      });
    }
    
    const herramienta = doc.data();
    
    if (herramienta.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para eliminar esta herramienta'
      });
    }
    
    await herramientaRef.delete();
    
    res.json({
      success: true,
      message: 'Herramienta eliminada exitosamente',
      data: { id: herramientaId, ...herramienta }
    });
  } catch (error) {
    console.error('❌ Error eliminando herramienta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar herramienta'
    });
  }
});

// 🧱 MATERIALES CNC

// Obtener todos los materiales del usuario
router.get('/inventario/materiales', authenticate, async (req, res) => {
  try {
    const materialesRef = db.collection('materiales');
    const snapshot = await materialesRef.where('usuarioId', '==', req.user.id).get();
    
    const materiales = [];
    snapshot.forEach(doc => {
      materiales.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      data: materiales,
      message: 'Materiales obtenidos correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo materiales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener materiales'
    });
  }
});

// Crear nuevo material
router.post('/inventario/materiales', authenticate, async (req, res) => {
  try {
    const nuevoMaterial = req.body;
    
    if (!nuevoMaterial.nombre || !nuevoMaterial.tipo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos (nombre, tipo)'
      });
    }
    
    const material = {
      nombre: nuevoMaterial.nombre,
      tipo: nuevoMaterial.tipo,
      formato: nuevoMaterial.formato || '',
      unidad: nuevoMaterial.unidad || 'kg',
      cantidad: parseFloat(nuevoMaterial.cantidad) || 0,
      stock_minimo: parseFloat(nuevoMaterial.stock_minimo) || 0,
      proveedor: nuevoMaterial.proveedor || '',
      especificaciones: nuevoMaterial.especificaciones || '',
      usuarioId: req.user.id,
      fecha_creacion: new Date().toISOString(),
      ultima_actualizacion: new Date().toISOString()
    };
    
    const docRef = await db.collection('materiales').add(material);
    
    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...material },
      message: 'Material creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando material:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear material'
    });
  }
});

// Actualizar material
router.put('/inventario/materiales/:id', authenticate, async (req, res) => {
  try {
    const materialId = req.params.id;
    const datosActualizados = req.body;
    
    const materialRef = db.collection('materiales').doc(materialId);
    const doc = await materialRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Material no encontrado'
      });
    }
    
    const materialActual = doc.data();
    
    if (materialActual.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para modificar este material'
      });
    }
    
    const materialActualizado = {
      ...materialActual,
      ...datosActualizados,
      ultima_actualizacion: new Date().toISOString()
    };
    
    await materialRef.update(materialActualizado);
    
    res.json({
      success: true,
      data: { id: materialId, ...materialActualizado },
      message: 'Material actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando material:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar material'
    });
  }
});

// Eliminar material
router.delete('/inventario/materiales/:id', authenticate, async (req, res) => {
  try {
    const materialId = req.params.id;
    
    const materialRef = db.collection('materiales').doc(materialId);
    const doc = await materialRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Material no encontrado'
      });
    }
    
    const material = doc.data();
    
    if (material.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para eliminar este material'
      });
    }
    
    await materialRef.delete();
    
    res.json({
      success: true,
      message: 'Material eliminado exitosamente',
      data: { id: materialId, ...material }
    });
  } catch (error) {
    console.error('❌ Error eliminando material:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar material'
    });
  }
});

// 📊 ESTADÍSTICAS ESPECÍFICAS PARA CNC

// Obtener estadísticas generales (para herramientas y materiales)
router.get('/inventario/estadisticas', authenticate, async (req, res) => {
  try {
    const usuarioId = req.user.id;

    // Consultar herramientas
    const herramientasRef = db.collection('herramientas');
    const herramientasSnapshot = await herramientasRef.where('usuarioId', '==', usuarioId).get();
    const herramientas = [];
    herramientasSnapshot.forEach(doc => herramientas.push({ id: doc.id, ...doc.data() }));

    // Consultar materiales
    const materialesRef = db.collection('materiales');
    const materialesSnapshot = await materialesRef.where('usuarioId', '==', usuarioId).get();
    const materiales = [];
    materialesSnapshot.forEach(doc => materiales.push({ id: doc.id, ...doc.data() }));

    // Calcular totales
    const totalHerramientas = herramientas.length;
    const totalMaterial = materiales.length;

    // Calcular alertas de stock (herramientas y materiales con stock <= stock_minimo)
    let alertasStock = 0;
    herramientas.forEach(h => {
      if (h.stock <= h.stock_minimo) alertasStock++;
    });
    materiales.forEach(m => {
      if (m.cantidad <= m.stock_minimo) alertasStock++;
    });

    // Herramientas en mantenimiento: actualmente no se almacena, se puede agregar luego.
    // Por ahora se deja en 0.
    const enMantenimiento = 0;

    res.json({
      success: true,
      data: {
        totalHerramientas,
        totalMaterial,
        enMantenimiento,
        alertasStock
      },
      message: 'Estadísticas obtenidas correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

// ==================== RUTAS ADICIONALES (PRODUCTOS Y CATEGORÍAS) ====================
// (Se mantienen las rutas originales para compatibilidad con otro frontend)

// 📦 PRODUCTOS (genéricos)

// Obtener todos los productos
router.get('/inventario/productos', authenticate, async (req, res) => {
  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef.where('usuarioId', '==', req.user.id).get();
    
    const productos = [];
    snapshot.forEach(doc => {
      productos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({
      success: true,
      data: productos,
      total: productos.length,
      message: 'Productos obtenidos correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos'
    });
  }
});

// Obtener producto por ID
router.get('/inventario/productos/:id', authenticate, async (req, res) => {
  try {
    const productoId = req.params.id;
    const productoRef = db.collection('productos').doc(productoId);
    const doc = await productoRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const producto = doc.data();
    
    if (producto.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para ver este producto'
      });
    }
    
    res.json({
      success: true,
      data: { id: doc.id, ...producto },
      message: 'Producto obtenido correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener producto'
    });
  }
});

// Crear nuevo producto
router.post('/inventario/productos', authenticate, async (req, res) => {
  try {
    const nuevoProducto = req.body;
    
    if (!nuevoProducto.codigo || !nuevoProducto.nombre || !nuevoProducto.categoria) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos (código, nombre, categoría)'
      });
    }
    
    let estado = 'stock';
    const stock = parseInt(nuevoProducto.stock) || 0;
    const stockMinimo = parseInt(nuevoProducto.stock_minimo) || 5;
    
    if (stock === 0) estado = 'agotado';
    else if (stock <= stockMinimo) estado = 'bajo_stock';
    
    const producto = {
      codigo: nuevoProducto.codigo,
      nombre: nuevoProducto.nombre,
      categoria: nuevoProducto.categoria,
      precio: parseFloat(nuevoProducto.precio) || 0,
      stock: stock,
      stock_minimo: stockMinimo,
      estado: estado,
      descripcion: nuevoProducto.descripcion || '',
      unidad_medida: nuevoProducto.unidad_medida || 'unidad',
      proveedor: nuevoProducto.proveedor || '',
      ubicacion: nuevoProducto.ubicacion || '',
      usuarioId: req.user.id,
      fecha_creacion: new Date().toISOString(),
      ultima_actualizacion: new Date().toISOString()
    };
    
    const docRef = await db.collection('productos').add(producto);
    
    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...producto },
      message: 'Producto creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear producto'
    });
  }
});

// Actualizar producto
router.put('/inventario/productos/:id', authenticate, async (req, res) => {
  try {
    const productoId = req.params.id;
    const datosActualizados = req.body;
    
    const productoRef = db.collection('productos').doc(productoId);
    const doc = await productoRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const productoActual = doc.data();
    
    if (productoActual.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para modificar este producto'
      });
    }
    
    let estado = 'stock';
    const stock = parseInt(datosActualizados.stock) || productoActual.stock;
    const stockMinimo = parseInt(datosActualizados.stock_minimo) || productoActual.stock_minimo;
    
    if (stock === 0) estado = 'agotado';
    else if (stock <= stockMinimo) estado = 'bajo_stock';
    
    const productoActualizado = {
      ...productoActual,
      ...datosActualizados,
      estado: estado,
      ultima_actualizacion: new Date().toISOString()
    };
    
    await productoRef.update(productoActualizado);
    
    res.json({
      success: true,
      data: { id: productoId, ...productoActualizado },
      message: 'Producto actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar producto'
    });
  }
});

// Eliminar producto
router.delete('/inventario/productos/:id', authenticate, async (req, res) => {
  try {
    const productoId = req.params.id;
    
    const productoRef = db.collection('productos').doc(productoId);
    const doc = await productoRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const producto = doc.data();
    
    if (producto.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para eliminar este producto'
      });
    }
    
    await productoRef.delete();
    
    res.json({
      success: true,
      message: 'Producto eliminado exitosamente',
      data: { id: productoId, ...producto }
    });
  } catch (error) {
    console.error('❌ Error eliminando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar producto'
    });
  }
});

// 📊 CATEGORÍAS (genéricas)

// Obtener todas las categorías
router.get('/inventario/categorias', authenticate, async (req, res) => {
  try {
    const categoriasRef = db.collection('categorias');
    const snapshot = await categoriasRef.where('usuarioId', '==', req.user.id).get();
    
    if (snapshot.empty) {
      // Crear categorías por defecto
      const categoriasDefault = [
        { nombre: 'Electrónica', descripcion: 'Dispositivos electrónicos', color: '#1976d2', icono: 'fas fa-laptop' },
        { nombre: 'Accesorios', descripcion: 'Accesorios de computadora', color: '#7b1fa2', icono: 'fas fa-mouse' },
        { nombre: 'Oficina', descripcion: 'Artículos de oficina', color: '#388e3c', icono: 'fas fa-print' },
        { nombre: 'Alimentos', descripcion: 'Productos alimenticios', color: '#f57c00', icono: 'fas fa-utensils' },
        { nombre: 'Ropa', descripcion: 'Prendas de vestir', color: '#d32f2f', icono: 'fas fa-tshirt' }
      ];
      
      const batch = db.batch();
      const categorias = [];
      
      for (const [index, categoria] of categoriasDefault.entries()) {
        const categoriaRef = categoriasRef.doc();
        const categoriaData = {
          ...categoria,
          usuarioId: req.user.id,
          fecha_creacion: new Date().toISOString(),
          orden: index
        };
        
        batch.set(categoriaRef, categoriaData);
        categorias.push({ id: categoriaRef.id, ...categoriaData });
      }
      
      await batch.commit();
      
      return res.json({
        success: true,
        data: categorias,
        total: categorias.length,
        message: 'Categorías por defecto creadas'
      });
    }
    
    const categorias = [];
    snapshot.forEach(doc => {
      categorias.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Obtener conteo de productos por categoría
    const productosSnapshot = await db.collection('productos')
      .where('usuarioId', '==', req.user.id)
      .get();
    
    const conteoProductos = {};
    productosSnapshot.forEach(doc => {
      const producto = doc.data();
      if (producto.categoria) {
        conteoProductos[producto.categoria] = (conteoProductos[producto.categoria] || 0) + 1;
      }
    });
    
    // Agregar conteo a categorías
    const categoriasConConteo = categorias.map(categoria => ({
      ...categoria,
      productoCount: conteoProductos[categoria.nombre] || 0
    }));
    
    res.json({
      success: true,
      data: categoriasConConteo,
      total: categoriasConConteo.length,
      message: 'Categorías obtenidas correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías'
    });
  }
});

// Crear nueva categoría
router.post('/inventario/categorias', authenticate, async (req, res) => {
  try {
    const nuevaCategoria = req.body;
    
    if (!nuevaCategoria.nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }
    
    const categoriasRef = db.collection('categorias');
    const querySnapshot = await categoriasRef
      .where('usuarioId', '==', req.user.id)
      .where('nombre', '==', nuevaCategoria.nombre)
      .get();
    
    if (!querySnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }
    
    const categoria = {
      nombre: nuevaCategoria.nombre,
      descripcion: nuevaCategoria.descripcion || '',
      color: nuevaCategoria.color || '#1976d2',
      icono: nuevaCategoria.icono || 'fas fa-tag',
      usuarioId: req.user.id,
      fecha_creacion: new Date().toISOString()
    };
    
    const docRef = await categoriasRef.add(categoria);
    
    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...categoria, productoCount: 0 },
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear categoría'
    });
  }
});

// Actualizar categoría
router.put('/inventario/categorias/:id', authenticate, async (req, res) => {
  try {
    const categoriaId = req.params.id;
    const datosActualizados = req.body;
    
    const categoriaRef = db.collection('categorias').doc(categoriaId);
    const doc = await categoriaRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    const categoriaActual = doc.data();
    
    if (categoriaActual.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para modificar esta categoría'
      });
    }
    
    if (datosActualizados.nombre && datosActualizados.nombre !== categoriaActual.nombre) {
      const categoriasRef = db.collection('categorias');
      const querySnapshot = await categoriasRef
        .where('usuarioId', '==', req.user.id)
        .where('nombre', '==', datosActualizados.nombre)
        .get();
      
      if (!querySnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una categoría con ese nombre'
        });
      }
    }
    
    const categoriaActualizada = {
      ...categoriaActual,
      ...datosActualizados,
      ultima_actualizacion: new Date().toISOString()
    };
    
    await categoriaRef.update(categoriaActualizada);
    
    res.json({
      success: true,
      data: { id: categoriaId, ...categoriaActualizada },
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoría'
    });
  }
});

// Eliminar categoría
router.delete('/inventario/categorias/:id', authenticate, async (req, res) => {
  try {
    const categoriaId = req.params.id;
    
    const categoriaRef = db.collection('categorias').doc(categoriaId);
    const doc = await categoriaRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    const categoria = doc.data();
    
    if (categoria.usuarioId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para eliminar esta categoría'
      });
    }
    
    const productosRef = db.collection('productos');
    const productosSnapshot = await productosRef
      .where('usuarioId', '==', req.user.id)
      .where('categoria', '==', categoria.nombre)
      .get();
    
    if (!productosSnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar la categoría porque tiene productos asociados',
        productosAsociados: productosSnapshot.size
      });
    }
    
    await categoriaRef.delete();
    
    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente',
      data: { id: categoriaId, ...categoria }
    });
  } catch (error) {
    console.error('❌ Error eliminando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar categoría'
    });
  }
});

// 📈 REPORTES (opcional, se mantiene)

router.get('/inventario/reporte-inventario', authenticate, async (req, res) => {
  try {
    const productosRef = db.collection('productos');
    const productosSnapshot = await productosRef.where('usuarioId', '==', req.user.id).get();
    
    const productos = [];
    let valorTotalInventario = 0;
    productosSnapshot.forEach(doc => {
      const producto = { id: doc.id, ...doc.data() };
      productos.push(producto);
      valorTotalInventario += producto.precio * producto.stock;
    });
    
    const categoriasRef = db.collection('categorias');
    const categoriasSnapshot = await categoriasRef.where('usuarioId', '==', req.user.id).get();
    
    const productosPorEstado = {
      stock: productos.filter(p => p.estado === 'stock').length,
      bajo_stock: productos.filter(p => p.estado === 'bajo_stock').length,
      agotado: productos.filter(p => p.estado === 'agotado').length
    };
    
    const topProductosValor = productos
      .sort((a, b) => (b.precio * b.stock) - (a.precio * a.stock))
      .slice(0, 5)
      .map(p => ({
        nombre: p.nombre,
        codigo: p.codigo,
        valor: (p.precio * p.stock).toFixed(2)
      }));
    
    const productosPorAgotarse = productos
      .filter(p => p.estado === 'bajo_stock' || p.estado === 'agotado')
      .slice(0, 10);
    
    const reporte = {
      fechaGeneracion: new Date().toISOString(),
      usuario: req.user.email,
      totalProductos: productos.length,
      totalCategorias: categoriasSnapshot.size,
      valorTotalInventario: valorTotalInventario.toFixed(2),
      productosPorEstado,
      topProductosValor,
      productosPorAgotarse
    };
    
    res.json({
      success: true,
      data: reporte,
      message: 'Reporte de inventario generado correctamente'
    });
  } catch (error) {
    console.error('❌ Error generando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte'
    });
  }
});

// Obtener productos recientes (opcional)
router.get('/inventario/productos-recientes', authenticate, async (req, res) => {
  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef
      .where('usuarioId', '==', req.user.id)
      .orderBy('fecha_creacion', 'desc')
      .limit(5)
      .get();
    
    const productosRecientes = [];
    snapshot.forEach(doc => {
      productosRecientes.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      data: productosRecientes,
      message: 'Productos recientes obtenidos correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo productos recientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos recientes'
    });
  }
});

// Obtener productos por agotarse (opcional)
router.get('/inventario/productos-agotarse', authenticate, async (req, res) => {
  try {
    const productosRef = db.collection('productos');
    const snapshot = await productosRef
      .where('usuarioId', '==', req.user.id)
      .where('estado', 'in', ['bajo_stock', 'agotado'])
      .orderBy('stock')
      .limit(10)
      .get();
    
    const productosAgotarse = [];
    snapshot.forEach(doc => {
      productosAgotarse.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({
      success: true,
      data: productosAgotarse,
      message: 'Productos por agotarse obtenidos correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo productos por agotarse:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos por agotarse'
    });
  }
});

// ==================== RUTA DE SALUD ====================
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;