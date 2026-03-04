const API_BASE_URL = '/api/auth';

class AuthController {
    constructor() {
        // Verificar si ya está inicializado
        if (window.authControllerInitialized) {
            console.log('⚠️ Auth controller ya inicializado');
            return;
        }
        
        console.log('🔐 Constructor de AuthController');
        
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.messageContainer = document.getElementById('messageContainer');
        this.messageText = document.getElementById('messageText');
        
        // Desactivar service workers
        this.disableServiceWorkers();
        
        // Marcar como inicializado
        window.authControllerInitialized = true;
        
        this.init();
    }

    disableServiceWorkers() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                    console.log('🗑️ Service Worker desregistrado (Auth)');
                });
            });
        }
    }

    init() {
        console.log('🔐 Inicializando auth controller...');
        
        this.checkIfAlreadyAuthenticated();
        this.initEventListeners();
    }

    initEventListeners() {
        // Login
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLogin(e), { once: true });
        }
        
        // Register
        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => this.handleRegister(e), { once: true });
        }

        // Switch forms
        const showRegisterLink = document.getElementById('showRegister');
        const showLoginLink = document.getElementById('showLogin');

        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToRegister();
                this.hideMessage();
            }, { once: true });
        }

        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToLogin();
                this.hideMessage();
            }, { once: true });
        }
    }

    async checkIfAlreadyAuthenticated() {
        console.log('🔍 Verificando autenticación previa...');
        
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            console.log('❌ No hay credenciales locales');
            return;
        }
        
        console.log('✅ Credenciales encontradas, verificando...');
        
        try {
            const isValid = await this.verifyTokenWithServer(token);
            if (isValid) {
                console.log('✅ Token válido, redirigiendo...');
                setTimeout(() => {
                    window.location.href = "/inventario";
                }, 500);
            } else {
                console.log('❌ Token inválido');
                this.clearAuthData();
            }
        } catch (error) {
            console.error('Error verificando token:', error);
            this.clearAuthData();
        }
    }

    async verifyTokenWithServer(token) {
        try {
            const response = await fetch(`${API_BASE_URL}/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.success === true;
            }
            return false;
        } catch (error) {
            console.error('Error verificando token:', error);
            return false;
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        this.hideMessage();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (!this.validateLoginForm(email, password)) {
            return;
        }
        
        const loginBtn = document.getElementById('loginBtn');
        this.setButtonLoading(loginBtn, true, 'Iniciando sesión...');
        
        try {
            const result = await this.login(email, password);
            
            if (result.success) {
                this.showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                this.saveAuthData(result.token, result.user);
                
                setTimeout(() => {
                    window.location.href = "/inventario";
                }, 1000);
            } else {
                this.showMessage(result.message || 'Error en el login', 'error');
                this.setButtonLoading(loginBtn, false, 'Iniciar Sesión');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error de conexión', 'error');
            this.setButtonLoading(loginBtn, false, 'Iniciar Sesión');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        this.hideMessage();
        
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        if (!this.validateRegisterForm(name, email, password, confirmPassword)) {
            return;
        }
        
        const registerBtn = document.getElementById('registerBtn');
        this.setButtonLoading(registerBtn, true, 'Registrando...');
        
        try {
            const result = await this.register(name, email, password);
            
            if (result.success) {
                this.showMessage('¡Registro exitoso! Redirigiendo...', 'success');
                this.saveAuthData(result.token, result.user);
                
                setTimeout(() => {
                    window.location.href = "/inventario";
                }, 1000);
            } else {
                this.showMessage(result.message || 'Error en el registro', 'error');
                this.setButtonLoading(registerBtn, false, 'Registrarse');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error de conexión', 'error');
            this.setButtonLoading(registerBtn, false, 'Registrarse');
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Error de conexión'
            };
        }
    }

    async register(name, email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Register error:', error);
            return {
                success: false,
                message: 'Error de conexión'
            };
        }
    }

    saveAuthData(token, user) {
        console.log('💾 Guardando datos de autenticación...');
        
        if (token) {
            localStorage.setItem('authToken', token);
        }
        
        if (user) {
            const userToSave = {
                id: user.id || user._id,
                name: user.name || 'Usuario',
                email: user.email || '',
                lastAccess: new Date().toISOString()
            };
            
            localStorage.setItem('user', JSON.stringify(userToSave));
        }
    }

    clearAuthData() {
        console.log('🧹 Limpiando datos de autenticación...');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    validateLoginForm(email, password) {
        let isValid = true;
        
        if (!this.validateEmail(email)) {
            this.showError('emailError', 'Correo inválido');
            isValid = false;
        } else {
            this.hideError('emailError');
        }
        
        if (password.length < 6) {
            this.showError('passwordError', 'Mínimo 6 caracteres');
            isValid = false;
        } else {
            this.hideError('passwordError');
        }
        
        return isValid;
    }

    validateRegisterForm(name, email, password, confirmPassword) {
        let isValid = true;
        
        if (name.length < 3) {
            this.showError('nameError', 'Mínimo 3 caracteres');
            isValid = false;
        } else {
            this.hideError('nameError');
        }
        
        if (!this.validateEmail(email)) {
            this.showError('regEmailError', 'Correo inválido');
            isValid = false;
        } else {
            this.hideError('regEmailError');
        }
        
        if (password.length < 6) {
            this.showError('regPasswordError', 'Mínimo 6 caracteres');
            isValid = false;
        } else {
            this.hideError('regPasswordError');
        }
        
        if (password !== confirmPassword) {
            this.showError('confirmPasswordError', 'Contraseñas no coinciden');
            isValid = false;
        } else {
            this.hideError('confirmPasswordError');
        }
        
        return isValid;
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
        }
    }
    
    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
        }
    }
    
    showMessage(message, type) {
        if (this.messageText && this.messageContainer) {
            this.messageText.textContent = message;
            this.messageContainer.className = 'message-container';
            this.messageContainer.classList.add(type);
            this.messageContainer.classList.remove('hidden');
        }
    }
    
    hideMessage() {
        if (this.messageContainer) {
            this.messageContainer.classList.add('hidden');
        }
    }

    setButtonLoading(button, loading, text) {
        if (button) {
            button.disabled = loading;
            button.textContent = text;
        }
    }

    switchToLogin() {
        const loginContainer = document.querySelector('.login-container');
        const registerContainer = document.querySelector('.register-container');
        if (loginContainer && registerContainer) {
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        }
    }

    switchToRegister() {
        const loginContainer = document.querySelector('.login-container');
        const registerContainer = document.querySelector('.register-container');
        if (loginContainer && registerContainer) {
            loginContainer.classList.add('hidden');
            registerContainer.classList.remove('hidden');
        }
    }
}

// Inicialización controlada
(function() {
    console.log('🔧 Inicializando sistema de autenticación...');
    
    // Solo inicializar si estamos en la página de login/register
    const isAuthPage = document.getElementById('loginForm') || document.getElementById('registerForm');
    
    if (!isAuthPage) {
        console.log('📌 No es página de auth');
        return;
    }
    
    // Prevenir múltiples inicializaciones
    if (window.authControllerInitialized) {
        console.log('⚠️ Auth controller ya inicializado');
        return;
    }
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new AuthController();
        }, { once: true });
    } else {
        new AuthController();
    }
})();