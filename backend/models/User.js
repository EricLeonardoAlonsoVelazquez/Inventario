const jwt = require('jsonwebtoken');
const config = require('../config/config'); 

class User {
  constructor(userData = {}) {
    this.id = userData.id || '';
    this.name = userData.name || '';
    this.email = userData.email || '';
    this.password = userData.password || '';
    this.creationDate = userData.creationDate || new Date();
    this.lastAccess = userData.lastAccess || new Date();
  }

  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 3) {
      errors.push('El nombre debe tener al menos 3 caracteres');
    }

    if (!this.email || !this.validateEmail(this.email)) {
      errors.push('El email no es válido');
    }

    if (!this.password || this.password.length < 6) {
      errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    return errors;
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  verifyPassword(plainPassword) {
    if (!this.password) {
      return false;
    }
    return this.password === plainPassword;
  }

  generateAuthToken() {
    return jwt.sign(
      { 
        userId: this.id,
        iat: Math.floor(Date.now() / 1000)
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      creationDate: this.creationDate,
      lastAccess: this.lastAccess
    };
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new Error('Token inválido');
    }
  }
}

module.exports = User;