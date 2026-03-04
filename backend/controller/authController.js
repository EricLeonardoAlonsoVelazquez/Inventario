const userService = require('../services/userService');
const { generateToken, setAuthCookie } = require('../middleware/auth');

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      console.log('📝 Intentando registrar usuario:', email);

      const validationErrors = await userService.validateUserRegistration({
        name,
        email,
        password
      });

      if (validationErrors.length > 0) {
        console.log('❌ Errores de validación:', validationErrors);
        return res.status(400).json({
          success: false,
          message: validationErrors.join(', ')
        });
      }

      const user = await userService.createUser({
        name,
        email,
        password
      });

      const token = generateToken(user.id);

      setAuthCookie(res, token);

      console.log('✅ Usuario registrado exitosamente:', email);
      console.log('🍪 Cookie establecida con token');

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: user,
        token: token
      });

    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log('🔐 Intentando login:', email);

      const { errors, user } = await userService.validateLoginCredentials(email, password);

      if (errors.length > 0) {
        console.log('❌ Error en login:', errors);
        return res.status(401).json({
          success: false,
          message: errors.join(', ')
        });
      }

      await userService.updateLastAccess(user.id);

      const token = generateToken(user.id);

      setAuthCookie(res, token);

      console.log('✅ Login exitoso:', email);
      console.log('🍪 Cookie establecida con token');

      res.json({
        success: true,
        message: 'Login exitoso',
        user: user.toJSON(),
        token: token
      });

    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async verifyToken(req, res) {
    try {
      const user = await userService.findById(req.user.id);
      
      res.json({
        success: true,
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async logout(req, res) {
    try {
      const { clearAuthCookie } = require('../middleware/auth');
      clearAuthCookie(res);
      
      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    } catch (error) {
      console.error('Error in logout:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AuthController();