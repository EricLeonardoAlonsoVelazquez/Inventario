class InventarioApp {
    constructor() {
        // Verificar si ya está inicializado
        if (window.inventarioAppInitialized) {
            console.log('⚠️ Inventario app ya inicializada, omitiendo');
            return;
        }
        
        console.log('⚙️ Constructor de InventarioApp CNC');
        
        this.isInitialized = false;
        this.isInitializing = false;
        this.verificationInProgress = false;
        this.herramientasData = [];
        this.materialesData = [];
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.dataTable = null;
        
        // Desactivar service workers
        this.disableServiceWorkers();
        
        // Marcar como inicializado
        window.inventarioAppInitialized = true;
        window.app = this;
        
        this.init();
    }

    disableServiceWorkers() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                    console.log('🗑️ Service Worker desregistrado');
                });
            });
        }
    }

    init() {
        console.log('⚙️ Inicializando sistema de inventario CNC...');
        
        // Verificar autenticación
        if (!this.token || !this.user) {
            console.log('❌ No autenticado, redirigiendo a login...');
            setTimeout(() => window.location.href = '/', 500);
            return;
        }

        // Usar requestAnimationFrame para mejor timing
        requestAnimationFrame(() => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeApp(), { once: true });
            } else {
                this.initializeApp();
            }
        });
    }

    async initializeApp() {
        if (this.isInitialized || this.isInitializing) {
            console.log('⚠️ App ya está inicializada o inicializándose');
            return;
        }
        
        this.isInitializing = true;
        console.log('🚀 Iniciando inicialización CNC...');
        
        try {
            // Verificar autenticación
            const isAuthenticated = await this.verifyAuthentication();
            if (!isAuthenticated) {
                this.redirectToLogin();
                return;
            }

            // Inicializar componentes
            this.initUI();
            this.initEventListeners();
            this.updateUIWithUserInfo();
            
            // Cargar datos
            await this.loadInitialData();
            
            this.isInitialized = true;
            console.log('✅ Sistema de inventario CNC inicializado');
            
        } catch (error) {
            console.error('💥 Error inicializando:', error);
            this.showError('Error al inicializar el sistema');
        } finally {
            this.isInitializing = false;
        }
    }

    async verifyAuthentication() {
        if (this.verificationInProgress) {
            console.log('⚠️ Verificación ya en progreso');
            return false;
        }
        
        this.verificationInProgress = true;
        console.log('🔐 Verificando autenticación...');
        
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.log(`❌ Error ${response.status} en verificación`);
                return false;
            }
            
            const result = await response.json();
            console.log('✅ Autenticación exitosa');
            return result.success === true;
            
        } catch (error) {
            console.error('❌ Error en verificación:', error);
            return false;
        } finally {
            this.verificationInProgress = false;
        }
    }

    redirectToLogin() {
        console.log('🚪 Redirigiendo a login...');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    initUI() {
        this.initDataTable();
        this.initModals();
    }

    initDataTable() {
        const tableElement = document.getElementById('tablaHerramientas');
        if (!tableElement) {
            console.warn('⚠️ Tabla de herramientas no encontrada');
            return;
        }
        
        if ($.fn.DataTable.isDataTable('#tablaHerramientas')) {
            console.log('ℹ️ DataTable ya existe');
            this.dataTable = $('#tablaHerramientas').DataTable();
            return;
        }
        
        try {
            this.dataTable = $('#tablaHerramientas').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
                },
                pageLength: 10,
                responsive: true,
                columnDefs: [
                    { 
                        targets: [9], // Columna de acciones
                        orderable: false,
                        searchable: false
                    }
                ]
            });
        } catch (error) {
            console.error('Error en DataTable:', error);
        }
    }

    initModals() {
        this.setupModal('herramientaModal', 'formHerramienta');
        this.setupModal('materialModal', 'formMaterial');
    }

    setupModal(modalId, formId) {
        const modal = document.getElementById(modalId);
        const form = document.getElementById(formId);
        
        if (!modal || !form) return;
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.remove('active');
                form.reset();
            };
        }
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                form.reset();
            }
        };
    }

    updateUIWithUserInfo() {
        if (!this.user) return;
        
        const userNameElement = document.getElementById('userName');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');
        
        if (userNameElement && this.user.name) {
            userNameElement.textContent = this.user.name;
        }
        
        if (dropdownUserName && this.user.name) {
            dropdownUserName.textContent = this.user.name;
        }
        
        if (dropdownUserEmail && this.user.email) {
            dropdownUserEmail.textContent = this.user.email;
        }
    }

    initEventListeners() {
        // Dropdown usuario
        const userMenuTrigger = document.getElementById('userMenuTrigger');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenuTrigger && userDropdown) {
            userMenuTrigger.onclick = (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            };
            
            document.onclick = () => {
                userDropdown.classList.remove('active');
            };
        }
        
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                this.handleLogout();
            };
        }
        
        // Botones principales CNC
        document.getElementById('btnNuevaHerramienta')?.addEventListener('click', () => this.openHerramientaModal());
        document.getElementById('btnNuevoMaterial')?.addEventListener('click', () => this.openMaterialModal());
        
        // Formularios CNC
        document.getElementById('formHerramienta')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarHerramienta();
        });
        
        document.getElementById('formMaterial')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarMaterial();
        });
        
        // Botones cancelar CNC
        document.getElementById('cancelarHerramienta')?.addEventListener('click', () => this.closeHerramientaModal());
        document.getElementById('cancelarMaterial')?.addEventListener('click', () => this.closeMaterialModal());
        
        // Filtros CNC
        document.getElementById('filtroTipo')?.addEventListener('change', (e) => this.filtrarPorTipo(e.target.value));
        document.getElementById('filtroEstado')?.addEventListener('change', (e) => this.filtrarPorEstado(e.target.value));
        document.getElementById('filtroMaquina')?.addEventListener('change', (e) => this.filtrarPorMaquina(e.target.value));
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.cargarHerramientas(),
                this.cargarMateriales()
            ]);
            
            await this.cargarEstadisticas();
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.showError('Error al cargar datos');
        }
    }

    async cargarHerramientas() {
        try {
            this.showLoading('Cargando herramientas...');
            
            const response = await fetch('/api/inventario/herramientas', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.herramientasData = result.data || [];
                this.renderHerramientasTable();
                this.hideLoading();
                return true;
            } else {
                throw new Error(`Error ${response.status}`);
            }
        } catch (error) {
            console.error('Error herramientas:', error);
            this.hideLoading();
            this.showError('Error cargando herramientas');
            this.herramientasData = [];
            this.renderHerramientasTable();
            return false;
        }
    }

    async cargarMateriales() {
        try {
            this.showLoading('Cargando materiales...');
            
            const response = await fetch('/api/inventario/materiales', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.materialesData = result.data || [];
                this.renderMaterialesGrid();
                this.hideLoading();
                return true;
            } else {
                throw new Error(`Error ${response.status}`);
            }
        } catch (error) {
            console.error('Error materiales:', error);
            this.hideLoading();
            this.showError('Error cargando materiales');
            this.materialesData = [];
            this.renderMaterialesGrid();
            return false;
        }
    }

    async cargarEstadisticas() {
        try {
            const response = await fetch('/api/inventario/estadisticas', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.updateStats(result.data);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error estadísticas:', error);
            return false;
        }
    }

    renderHerramientasTable() {
        if (!this.dataTable) return;
        
        this.dataTable.clear();
        
        if (this.herramientasData.length === 0) {
            this.dataTable.row.add([
                '', '', 'No hay herramientas', '', '', '', '', '', '', ''
            ]).draw();
            return;
        }
        
        this.herramientasData.forEach(herramienta => {
            let estado = 'optimo';
            const stock = parseInt(herramienta.stock) || 0;
            const stockMinimo = parseInt(herramienta.stock_minimo) || 3;
            
            if (stock <= 0) {
                estado = 'reemplazar';
            } else if (stock <= stockMinimo) {
                estado = 'desgaste';
            } else if (herramienta.estado === 'mantenimiento') {
                estado = 'mantenimiento';
            }
            
            const estadosHTML = {
                'optimo': '<span class="badge badge-success">Óptimo</span>',
                'desgaste': '<span class="badge badge-warning">En desgaste</span>',
                'reemplazar': '<span class="badge badge-danger">Por reemplazar</span>',
                'mantenimiento': '<span class="badge badge-info">En mantenimiento</span>'
            };
            
            this.dataTable.row.add([
                herramienta.codigo || 'N/A',
                herramienta.descripcion || 'Sin descripción',
                herramienta.tipo || 'Sin tipo',
                `${parseFloat(herramienta.diametro || 0).toFixed(2)} mm`,
                herramienta.material || 'N/A',
                stock,
                stockMinimo,
                herramienta.ubicacion || 'Sin ubicación',
                estadosHTML[estado] || '<span class="badge badge-secondary">Desconocido</span>',
                `
                    <div class="acciones-buttons">
                        <button class="btn-action btn-edit" data-id="${herramienta.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-id="${herramienta.id}" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `
            ]);
        });
        
        this.dataTable.draw();
        
        // Event listeners para botones
        $('#tablaHerramientas').off('click', '.btn-edit').on('click', '.btn-edit', (e) => {
            const herramientaId = $(e.currentTarget).data('id');
            const herramienta = this.herramientasData.find(h => h.id === herramientaId);
            if (herramienta) this.editarHerramienta(herramienta);
        });

        $('#tablaHerramientas').off('click', '.btn-delete').on('click', '.btn-delete', (e) => {
            const herramientaId = $(e.currentTarget).data('id');
            this.eliminarHerramienta(herramientaId);
        });
    }

    renderMaterialesGrid() {
        const materialesGrid = document.getElementById('materialesGrid');
        if (!materialesGrid) return;

        materialesGrid.innerHTML = '';
        
        if (this.materialesData.length === 0) {
            materialesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cube"></i>
                    <p>No hay materiales en stock</p>
                    <button class="btn-primary" id="btnCrearMaterialEmpty">
                        <i class="fas fa-plus"></i> Agregar primer material
                    </button>
                </div>
            `;
            
            document.getElementById('btnCrearMaterialEmpty')?.addEventListener('click', () => {
                this.openMaterialModal();
            });
            return;
        }
        
        this.materialesData.forEach(material => {
            const materialCard = document.createElement('div');
            materialCard.className = 'material-card';
            
            // Determinar color según stock
            let stockClass = '';
            const stock = parseFloat(material.cantidad) || 0;
            const stockMinimo = parseFloat(material.stock_minimo) || 0;
            
            if (stock <= 0) {
                stockClass = 'stock-out';
            } else if (stock <= stockMinimo) {
                stockClass = 'stock-low';
            } else {
                stockClass = 'stock-ok';
            }
            
            materialCard.innerHTML = `
                <div class="material-header">
                    <h3><i class="fas fa-weight-hanging"></i> ${material.nombre}</h3>
                    <span class="material-badge ${stockClass}">${stock} ${material.unidad || 'unidades'}</span>
                </div>
                <div class="material-info">
                    <p><strong>Tipo:</strong> ${material.tipo || 'No especificado'}</p>
                    <p><strong>Formato:</strong> ${material.formato || 'No especificado'}</p>
                    <p><strong>Stock mínimo:</strong> ${stockMinimo} ${material.unidad || 'unidades'}</p>
                    <p><strong>Proveedor:</strong> ${material.proveedor || 'No especificado'}</p>
                </div>
                <div class="material-actions">
                    <button class="btn-action btn-edit-material" data-id="${material.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-action btn-delete-material" data-id="${material.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
            
            materialesGrid.appendChild(materialCard);
        });

        document.querySelectorAll('.btn-edit-material').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const materialId = e.currentTarget.dataset.id;
                const material = this.materialesData.find(m => m.id === materialId);
                if (material) this.editarMaterial(material);
            });
        });

        document.querySelectorAll('.btn-delete-material').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const materialId = e.currentTarget.dataset.id;
                this.eliminarMaterial(materialId);
            });
        });
    }

    updateStats(stats) {
        if (!stats) return;
        
        const statsMap = {
            'totalHerramientas': 'totalHerramientas',
            'totalMaterial': 'totalMaterial',
            'enMantenimiento': 'enMantenimiento',
            'alertasStock': 'alertasStock'
        };
        
        Object.entries(statsMap).forEach(([elementId, statKey]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = stats[statKey] || 0;
            }
        });
    }

    openHerramientaModal(herramienta = null) {
        const modal = document.getElementById('herramientaModal');
        const form = document.getElementById('formHerramienta');
        const modalTitle = document.getElementById('modalTitleHerramienta');
        
        if (!modal || !form) return;
        
        if (herramienta) {
            modalTitle.textContent = 'Editar Herramienta';
            form.dataset.herramientaId = herramienta.id;
            document.getElementById('codigoHerramienta').value = herramienta.codigo || '';
            document.getElementById('descripcionHerramienta').value = herramienta.descripcion || '';
            document.getElementById('tipoHerramienta').value = herramienta.tipo || '';
            document.getElementById('diametroHerramienta').value = herramienta.diametro || '';
            document.getElementById('materialHerramienta').value = herramienta.material || '';
            document.getElementById('stockHerramienta').value = herramienta.stock || '';
            document.getElementById('stockMinimoHerramienta').value = herramienta.stock_minimo || 3;
            document.getElementById('ubicacionHerramienta').value = herramienta.ubicacion || '';
            document.getElementById('maquinaHerramienta').value = herramienta.maquina || '';
            document.getElementById('notasHerramienta').value = herramienta.notas || '';
        } else {
            modalTitle.textContent = 'Nueva Herramienta';
            delete form.dataset.herramientaId;
            form.reset();
            
            if (!document.getElementById('codigoHerramienta').value) {
                document.getElementById('codigoHerramienta').value = 'HTL-' + Date.now().toString().slice(-6);
            }
        }
        
        modal.classList.add('active');
    }

    closeHerramientaModal() {
        const modal = document.getElementById('herramientaModal');
        const form = document.getElementById('formHerramienta');
        if (modal) modal.classList.remove('active');
        if (form) {
            form.reset();
            delete form.dataset.herramientaId;
        }
    }

    openMaterialModal(material = null) {
        const modal = document.getElementById('materialModal');
        const form = document.getElementById('formMaterial');
        const modalTitle = document.getElementById('modalTitleMaterial');
        
        if (!modal || !form) return;
        
        if (material) {
            modalTitle.textContent = 'Editar Material';
            form.dataset.materialId = material.id;
            document.getElementById('nombreMaterial').value = material.nombre || '';
            document.getElementById('tipoMaterial').value = material.tipo || '';
            document.getElementById('formatoMaterial').value = material.formato || '';
            document.getElementById('unidadMaterial').value = material.unidad || 'kg';
            document.getElementById('cantidadMaterial').value = material.cantidad || '';
            document.getElementById('stockMinimoMaterial').value = material.stock_minimo || '';
            document.getElementById('proveedorMaterial').value = material.proveedor || '';
            document.getElementById('especificacionesMaterial').value = material.especificaciones || '';
        } else {
            modalTitle.textContent = 'Nuevo Material';
            delete form.dataset.materialId;
            form.reset();
            document.getElementById('unidadMaterial').value = 'kg';
        }
        
        modal.classList.add('active');
    }

    closeMaterialModal() {
        const modal = document.getElementById('materialModal');
        const form = document.getElementById('formMaterial');
        if (modal) modal.classList.remove('active');
        if (form) {
            form.reset();
            delete form.dataset.materialId;
        }
    }

    async guardarHerramienta() {
        const form = document.getElementById('formHerramienta');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const herramientaData = {
            codigo: document.getElementById('codigoHerramienta').value.trim(),
            descripcion: document.getElementById('descripcionHerramienta').value.trim(),
            tipo: document.getElementById('tipoHerramienta').value,
            diametro: parseFloat(document.getElementById('diametroHerramienta').value) || 0,
            material: document.getElementById('materialHerramienta').value,
            stock: parseInt(document.getElementById('stockHerramienta').value) || 0,
            stock_minimo: parseInt(document.getElementById('stockMinimoHerramienta').value) || 3,
            ubicacion: document.getElementById('ubicacionHerramienta').value.trim(),
            maquina: document.getElementById('maquinaHerramienta').value,
            notas: document.getElementById('notasHerramienta').value.trim()
        };

        // Validaciones
        if (!herramientaData.codigo) {
            this.showError('Ingresa un código de herramienta');
            return;
        }
        if (!herramientaData.descripcion) {
            this.showError('Ingresa una descripción');
            return;
        }
        if (!herramientaData.tipo) {
            this.showError('Selecciona un tipo de herramienta');
            return;
        }
        if (herramientaData.diametro <= 0) {
            this.showError('El diámetro debe ser mayor a 0');
            return;
        }

        const herramientaId = form.dataset.herramientaId;
        const isEdit = !!herramientaId;

        try {
            this.showLoading(isEdit ? 'Actualizando herramienta...' : 'Creando herramienta...');
            
            const url = isEdit ? `/api/inventario/herramientas/${herramientaId}` : '/api/inventario/herramientas';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(herramientaData)
            });

            if (response.ok) {
                this.showSuccess(isEdit ? 'Herramienta actualizada' : 'Herramienta creada');
                this.closeHerramientaModal();
                await this.cargarHerramientas();
                await this.cargarEstadisticas();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al guardar');
            }
        } catch (error) {
            console.error('Error guardando herramienta:', error);
            this.showError(error.message || 'Error al guardar');
        } finally {
            this.hideLoading();
        }
    }

    async guardarMaterial() {
        const form = document.getElementById('formMaterial');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const materialData = {
            nombre: document.getElementById('nombreMaterial').value.trim(),
            tipo: document.getElementById('tipoMaterial').value,
            formato: document.getElementById('formatoMaterial').value,
            unidad: document.getElementById('unidadMaterial').value,
            cantidad: parseFloat(document.getElementById('cantidadMaterial').value) || 0,
            stock_minimo: parseFloat(document.getElementById('stockMinimoMaterial').value) || 0,
            proveedor: document.getElementById('proveedorMaterial').value.trim(),
            especificaciones: document.getElementById('especificacionesMaterial').value.trim()
        };

        if (!materialData.nombre) {
            this.showError('Ingresa un nombre');
            return;
        }
        if (!materialData.tipo) {
            this.showError('Selecciona un tipo de material');
            return;
        }
        if (materialData.cantidad < 0) {
            this.showError('La cantidad no puede ser negativa');
            return;
        }

        const materialId = form.dataset.materialId;
        const isEdit = !!materialId;

        try {
            this.showLoading(isEdit ? 'Actualizando material...' : 'Creando material...');
            
            const url = isEdit ? `/api/inventario/materiales/${materialId}` : '/api/inventario/materiales';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(materialData)
            });

            if (response.ok) {
                this.showSuccess(isEdit ? 'Material actualizado' : 'Material creado');
                this.closeMaterialModal();
                await this.cargarMateriales();
                await this.cargarEstadisticas();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al guardar');
            }
        } catch (error) {
            console.error('Error guardando material:', error);
            this.showError(error.message || 'Error al guardar');
        } finally {
            this.hideLoading();
        }
    }

    editarHerramienta(herramienta) {
        this.openHerramientaModal(herramienta);
    }

    editarMaterial(material) {
        this.openMaterialModal(material);
    }

    async eliminarHerramienta(id) {
        if (!confirm('¿Eliminar esta herramienta?')) return;

        try {
            this.showLoading('Eliminando herramienta...');
            
            const response = await fetch(`/api/inventario/herramientas/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showSuccess('Herramienta eliminada');
                await this.cargarHerramientas();
                await this.cargarEstadisticas();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al eliminar');
            }
        } catch (error) {
            console.error('Error eliminando herramienta:', error);
            this.showError(error.message || 'Error al eliminar');
        } finally {
            this.hideLoading();
        }
    }

    async eliminarMaterial(id) {
        if (!confirm('¿Eliminar este material?')) return;

        try {
            this.showLoading('Eliminando material...');
            
            const response = await fetch(`/api/inventario/materiales/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showSuccess('Material eliminado');
                await this.cargarMateriales();
                await this.cargarEstadisticas();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al eliminar');
            }
        } catch (error) {
            console.error('Error eliminando material:', error);
            this.showError(error.message || 'Error al eliminar');
        } finally {
            this.hideLoading();
        }
    }

    filtrarPorTipo(tipo) {
        if (!this.dataTable) return;
        this.dataTable.column(2).search(tipo || '').draw();
    }

    filtrarPorEstado(estado) {
        if (!this.dataTable) return;
        
        let searchTerm = '';
        switch(estado) {
            case 'optimo': searchTerm = 'Óptimo'; break;
            case 'desgaste': searchTerm = 'En desgaste'; break;
            case 'reemplazar': searchTerm = 'Por reemplazar'; break;
            case 'mantenimiento': searchTerm = 'En mantenimiento'; break;
        }
        
        this.dataTable.column(8).search(searchTerm).draw();
    }

    filtrarPorMaquina(maquina) {
        if (!this.dataTable) return;
        // Asumiendo que la columna 8 es estado, necesitaríamos agregar columna de máquina
        // Por ahora filtramos por cualquier columna que contenga la máquina
        this.dataTable.search(maquina || '').draw();
    }

    handleLogout() {
        if (confirm('¿Cerrar sesión?')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    }

    // UI Helpers
    showLoading(message = 'Cargando...') {
        let loadingDiv = document.getElementById('loadingOverlay');
        if (!loadingDiv) {
            loadingDiv = this.createLoadingOverlay();
        }
        loadingDiv.querySelector('#loadingMessage').textContent = message;
        loadingDiv.style.display = 'flex';
    }

    hideLoading() {
        const loadingDiv = document.getElementById('loadingOverlay');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Limpiar notificaciones previas
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Mostrar
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Cerrar al hacer clic
        notification.querySelector('.notification-close').onclick = () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        };
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            flex-direction: column;
        `;
        
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p id="loadingMessage" style="color: white; margin-top: 20px;">Cargando...</p>
        `;
        
        // Agregar estilos
        const style = document.createElement('style');
        style.textContent = `
            .spinner {
                width: 50px;
                height: 50px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        
        return overlay;
    }
}

// Inicialización controlada para CNC
(function() {
    console.log('⚙️ Script de inventario CNC cargado');
    
    // Solo inicializar si estamos en la página correcta
    const isInventarioPage = document.getElementById('userName') || 
                            document.getElementById('tablaHerramientas');
    
    if (!isInventarioPage) {
        console.log('📌 No es página de inventario CNC');
        return;
    }
    
    // Prevenir múltiples inicializaciones
    if (window.inventarioAppInitialized) {
        console.log('⚠️ App ya inicializada globalmente');
        return;
    }
    
    // Esperar a jQuery y DataTables
    function waitForDependencies(callback) {
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }
    
    // Inicializar cuando esté todo listo
    function initialize() {
        try {
            new InventarioApp();
        } catch (error) {
            console.error('💥 Error fatal:', error);
        }
    }
    
    // Esperar al DOM y dependencias
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            waitForDependencies(initialize);
        }, { once: true });
    } else {
        waitForDependencies(initialize);
    }
})();