const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const MongoService = {
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            return await response.json();
        } catch (error) {
            console.error("Login API Error:", error);
            throw error;
        }
    },

    async getEntrenadores() {
        try {
            const response = await fetch(`${API_URL}/entrenadores`);
            if (!response.ok) throw new Error('Error al obtener entrenadores');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async createEntrenador(entrenadorData) {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entrenadorData)
            });
            if (!response.ok) throw new Error('Error al crear entrenador');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async getUsuarios() {
        try {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) throw new Error('Error al obtener usuarios');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async updateUsuario(userId, updateData) {
        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error('Error al actualizar usuario');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async deleteUsuario(userId) {
        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar usuario');
            }
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async getMembresias() {
        try {
            const response = await fetch(`${API_URL}/membresias`);
            if (!response.ok) throw new Error('Error al obtener membresías');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async createMembresia(data) {
        try {
            const response = await fetch(`${API_URL}/membresias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error al crear membresía');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async updateMembresia(id, data) {
        try {
            const response = await fetch(`${API_URL}/membresias/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error al actualizar membresía');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async deleteMembresia(id) {
        try {
            const response = await fetch(`${API_URL}/membresias/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar membresía');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async getAlumnos(entrenadorId = null) {
        try {
            let url = `${API_URL}/alumnos`;
            if (entrenadorId) {
                url += `?entrenadorId=${entrenadorId}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al obtener alumnos');
            // Normalize _id to id for frontend compatibility if needed, though Vue handles _id fine usually
            const data = await response.json();
            return data.map(alumno => ({
                ...alumno,
                id: alumno._id // Ensure we have an id property for existing components
            }));
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async createAlumno(alumno) {
        try {
            const response = await fetch(`${API_URL}/alumnos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alumno)
            });
            if (!response.ok) throw new Error('Error al crear alumno');
            const saved = await response.json();
            return { ...saved, id: saved._id };
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async addPago(alumnoId, pago) {
        try {
            // Backend expects :id in URL
            const response = await fetch(`${API_URL}/alumnos/${alumnoId}/pagos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pago)
            });
            if (!response.ok) throw new Error('Error al registrar pago');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async updateAlumno(id, alumno) {
        try {
            const response = await fetch(`${API_URL}/alumnos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alumno)
            });
            if (!response.ok) throw new Error('Error updating alumno');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async deleteAlumno(id) {
        try {
            const response = await fetch(`${API_URL}/alumnos/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar alumno');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    // --- PRODUCTS ---
    async getProducts() {
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error('Error al obtener productos');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async createProduct(data) {
        try {
            const response = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error al crear producto');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async updateProduct(id, data) {
        try {
            const response = await fetch(`${API_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error al actualizar producto');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async deleteProduct(id) {
        try {
            const response = await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar producto');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    // --- SALES ---
    async createSale(data) {
        try {
            const response = await fetch(`${API_URL}/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al registrar venta');
            }
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async adjustStock(productId, newStock, reason) {
        try {
            const response = await fetch(`${API_URL}/products/${productId}/adjust-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newStock, reason })
            });
            if (!response.ok) throw new Error('Error al actualizar stock');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async getStockLogs(productId) {
        try {
            const response = await fetch(`${API_URL}/products/${productId}/stock-logs`);
            if (!response.ok) throw new Error('Error al obtener historial');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    async getSalesStats(productId, sellerId = null) {
        try {
            let url = `${API_URL}/products/${productId}/sales-stats`;
            if (sellerId) {
                url += `?sellerId=${sellerId}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al obtener estadísticas de ventas');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    async getGeneralSalesStats(startDate, endDate) {
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await fetch(`${API_URL}/sales/general-stats?${params.toString()}`);
            if (!response.ok) throw new Error('Error al obtener estadísticas generales');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }
};
