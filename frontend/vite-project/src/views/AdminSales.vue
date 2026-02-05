<script setup>
import { ref, onMounted, computed } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const products = ref([])
const isLoading = ref(false)
const error = ref("")
const currentUser = ref(null)

// Modals state
const showProductModal = ref(false)
const showSaleModal = ref(false)
const showStockModal = ref(false) // New
const showPriceModal = ref(false) // New Price Modal
const showHistoryModal = ref(false) // New
const isEditing = ref(false)

// Forms data
const productForm = ref({
  id: null,
  name: "",
  price: 0,
  stock: 0,
  category: "General"
})

const saleForm = ref({
  product: null,
  productName: "",
  price: 0,
  quantity: 1,
  maxStock: 0
})

const saleTotal = computed(() => {
  return saleForm.value.price * saleForm.value.quantity
})

// Stock Adjustment Form
const stockForm = ref({
  product: null,
  productName: "",
  currentStock: 0,
  newStock: 0,
  reason: ""
})

// Price Update Form
const priceForm = ref({
  id: null,
  name: "",
  currentPrice: 0,
  newPrice: 0
})

const historyLogs = ref([])
const historyProduct = ref(null)
const salesStats = ref(null) // New
const showSalesStatsModal = ref(false) // New

const isAdmin = computed(() => currentUser.value?.role === 'admin')

onMounted(() => {
  const userStr = localStorage.getItem("user")
  if (userStr) {
    currentUser.value = JSON.parse(userStr)
  }
  loadProducts()
})

async function loadProducts() {
  try {
    isLoading.value = true
    products.value = await MongoService.getProducts()
  } catch (e) {
    error.value = "Error al cargar productos"
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  if (isAdmin.value) {
    router.push("/admin")
  } else {
    router.push("/dashboard")
  }
}

// --- Product Management ---
function openCreateModal() {
  isEditing.value = false
  productForm.value = { name: "", price: 0, stock: 0, category: "General" }
  showProductModal.value = true
}

function openEditModal(product) {
  isEditing.value = true
  productForm.value = { 
    id: product._id,
    name: product.name, 
    price: product.price, 
    stock: product.stock, 
    category: product.category 
  }
  showProductModal.value = true
}

async function saveProduct() {
  try {
    if (isEditing.value) {
      await MongoService.updateProduct(productForm.value.id, productForm.value)
    } else {
      await MongoService.createProduct(productForm.value)
    }
    showProductModal.value = false
    loadProducts()
  } catch (e) {
    alert("Error al guardar producto: " + e.message)
  }
}

async function deleteProduct(id) {
  if (!confirm("⚠️ ¡ADVERTENCIA! \n\nEsto eliminará el producto y TODAS su ventas históricas. Esta acción afectará las estadísticas de recaudación pasadas. \n\n¿Desea continuar?")) return
  try {
    await MongoService.deleteProduct(id)
    loadProducts()
  } catch (e) {
    alert("Error al eliminar: " + e.message)
  }
}

// --- Stock Adjustment ---
function openStockModal(product) {
  stockForm.value = {
    product: product._id,
    productName: product.name,
    currentStock: product.stock,
    newStock: product.stock,
    reason: ""
  }
  showStockModal.value = true
}

async function updateStock() {
  if (!stockForm.value.reason.trim()) {
    alert("Por favor, ingresa un motivo para el ajuste.")
    return
  }
  try {
    await MongoService.adjustStock(
      stockForm.value.product,
      stockForm.value.newStock,
      stockForm.value.reason
    )
    showStockModal.value = false
    alert("Stock actualizado exitosamente")
    loadProducts()
  } catch (e) {
    alert("Error al actualizar stock: " + e.message)
  }
}

// --- Price Update ---
function openPriceModal(product) {
  priceForm.value = {
    id: product._id,
    name: product.name,
    currentPrice: product.price,
    newPrice: product.price
  }
  showPriceModal.value = true
}

async function updatePriceOnly() {
  if (priceForm.value.newPrice < 0) {
    alert("El precio no puede ser negativo")
    return
  }
  try {
    // Reusing updateProduct but only sending price
    await MongoService.updateProduct(priceForm.value.id, {
      price: priceForm.value.newPrice
    })
    showPriceModal.value = false
    alert("Precio actualizado exitosamente")
    loadProducts()
  } catch (e) {
    alert("Error al actualizar precio: " + e.message)
  }
}

// --- History & Stats ---
// --- General Stats (Admin Only) ---
const showGeneralStatsModal = ref(false)
const generalStats = ref(null)
const expandedSellers = ref([]) // Array of seller names
const statsDateRange = ref({
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
})
const isLoadingStats = ref(false)

function openGeneralStatsModal() {
  showGeneralStatsModal.value = true
  loadGeneralStats()
}

function toggleSeller(name) {
  if (expandedSellers.value.includes(name)) {
    expandedSellers.value = expandedSellers.value.filter(n => n !== name)
  } else {
    expandedSellers.value.push(name)
  }
}

async function loadGeneralStats() {
  try {
    isLoadingStats.value = true
    generalStats.value = await MongoService.getGeneralSalesStats(
      statsDateRange.value.start,
      statsDateRange.value.end
    )
  } catch (e) {
    console.error("Error loading general stats:", e)
    alert("Error al cargar estadísticas")
  } finally {
    isLoadingStats.value = false
  }
}

async function openHistoryModal(product) {
  historyProduct.value = product
  
  if (isAdmin.value) {
    historyLogs.value = []
    showHistoryModal.value = true
    try {
      historyLogs.value = await MongoService.getStockLogs(product._id)
    } catch (e) {
      console.error("Error fetching history:", e)
    }
  } else {
    // For Trainer: Show Sales Stats
    salesStats.value = null
    showSalesStatsModal.value = true
    try {
      const sellerId = isAdmin.value ? null : currentUser.value._id
      salesStats.value = await MongoService.getSalesStats(product._id, sellerId)
    } catch (e) {
      console.error("Error fetching stats:", e)
    }
  }
}

function formatDate(date) {
  return new Date(date).toLocaleString()
}

// --- Sales Management ---
function openSaleModal(product) {
  if (product.stock <= 0) {
    alert("No hay stock disponible")
    return
  }
  saleForm.value = {
    product: product._id,
    productName: product.name,
    price: product.price,
    quantity: 1,
    maxStock: product.stock
  }
  showSaleModal.value = true
}

async function registerSale() {
  try {
    const saleData = {
      items: [{
        product: saleForm.value.product,
        quantity: saleForm.value.quantity,
        price: saleForm.value.price
      }],
      total: saleTotal.value,
      seller: currentUser.value ? (currentUser.value._id || currentUser.value.id) : null
    }
    
    await MongoService.createSale(saleData)
    showSaleModal.value = false
    alert("Venta registrada con éxito")
    loadProducts() // Reload to update stock
  } catch (e) {
    alert("Error al registrar venta: " + e.message)
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}
</script>

<template>
  <div class="admin-sales-container">
    <div class="admin-sales-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Ventas y Stock</h1>
          <p class="subtitle">Gestiona productos y registra ventas</p>
        </div>
      </div>
      <button v-if="isAdmin" @click="openCreateModal" class="create-button">+ Nuevo Producto</button>
      <button v-if="isAdmin" @click="openGeneralStatsModal" class="stats-button">📊 Estadísticas</button>
    </div>

    <div class="content-area">
      <div v-if="isLoading" class="loading">Cargando...</div>
      
      <div v-else-if="products.length === 0" class="empty-state">
        <p>No hay productos registrados. Agrega uno nuevo.</p>
      </div>

      <div v-else class="products-list-container">
        <table class="products-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Acciones</th>
              <th>Historial</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product._id">
              <td>
                <div class="product-name">{{ product.name }}</div>
                <div class="product-category">{{ product.category }}</div>
              </td>
              <td class="price-cell">{{ formatPrice(product.price) }}</td>
              <td>
                <span class="stock-badge" :class="{ 'low-stock': product.stock < 5, 'out-stock': product.stock === 0 }">
                  {{ product.stock }} un.
                </span>
              </td>
              <td class="actions-cell">
                <button @click="openSaleModal(product)" class="sell-button-small" :disabled="product.stock === 0">
                  Vender
                </button>
                <button v-if="isAdmin" @click="openStockModal(product)" class="stock-button-small" title="Ajustar Stock">📦</button>
                <button v-if="isAdmin" @click="openPriceModal(product)" class="price-button-small" title="Actualizar Precio">$</button>
                <div v-if="isAdmin" class="icon-actions">
                  <button @click="openEditModal(product)" class="icon-button" title="Editar">✏️</button>
                  <button @click="deleteProduct(product._id)" class="icon-button delete" title="Eliminar">🗑️</button>
                </div>
              </td>
              <td>
                <button @click="openHistoryModal(product)" class="history-link">
                  {{ isAdmin ? 'Ver historial stock' : 'Ver ventas' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Product Modal -->
    <div v-if="showProductModal" class="modal-overlay" @click.self="showProductModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Editar Producto' : 'Nuevo Producto' }}</h2>
          <button @click="showProductModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="saveProduct" class="modal-form">
          <div class="form-group">
            <label>Nombre del Producto</label>
            <input v-model="productForm.name" required placeholder="Ej. Proteína Whey" />
          </div>
          <div class="form-group row">
            <div class="col">
              <label>Precio</label>
              <input type="number" v-model="productForm.price" required min="0" />
            </div>
            <div class="col">
              <label>Stock Inicial</label>
              <input type="number" v-model="productForm.stock" required min="0" />
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showProductModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Guardar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Sale Modal -->
    <div v-if="showSaleModal" class="modal-overlay" @click.self="showSaleModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Registrar Venta</h2>
          <button @click="showSaleModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="registerSale" class="modal-form">
          <div class="product-summary">
            <h3>{{ saleForm.productName }}</h3>
            <p>Precio Unitario: {{ formatPrice(saleForm.price) }}</p>
            <p>Stock Disponible: {{ saleForm.maxStock }}</p>
          </div>
          
          <div class="form-group">
            <label>Cantidad</label>
            <input 
              type="number" 
              v-model="saleForm.quantity" 
              required 
              min="1" 
              :max="saleForm.maxStock" 
            />
          </div>

          <div class="total-summary">
            <span>Total a Cobrar:</span>
            <span class="total-amount">{{ formatPrice(saleTotal) }}</span>
          </div>

          <div class="modal-actions">
            <button type="button" @click="showSaleModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button confirm-sale">Confirmar Venta</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Stock Adjustment Modal -->
    <div v-if="showStockModal" class="modal-overlay" @click.self="showStockModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Actualizar Stock</h2>
          <button @click="showStockModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="updateStock" class="modal-form">
          <div class="product-summary">
            <h3>{{ stockForm.productName }}</h3>
            <p>Stock Actual: {{ stockForm.currentStock }}</p>
          </div>
          
          <div class="form-group row">
             <div class="col">
                <label>Nuevo Stock</label>
                <input type="number" v-model="stockForm.newStock" required min="0" />
             </div>
          </div>

          <div class="form-group">
            <label>Motivo del Ajuste</label>
            <input 
              v-model="stockForm.reason" 
              required 
              placeholder="Ej. Reabastecimiento, Pérdida, Corrección..." 
            />
          </div>

          <div class="modal-actions">
            <button type="button" @click="showStockModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Actualizar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Price Update Modal -->
    <div v-if="showPriceModal" class="modal-overlay" @click.self="showPriceModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Actualizar Precio</h2>
          <button @click="showPriceModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="updatePriceOnly" class="modal-form">
          <div class="product-summary">
            <h3>{{ priceForm.name }}</h3>
            <p>Precio Actual: {{ formatPrice(priceForm.currentPrice) }}</p>
          </div>
          
          <div class="form-group">
             <label>Nuevo Precio</label>
             <input type="number" v-model="priceForm.newPrice" required min="0" />
          </div>

          <div class="modal-actions">
            <button type="button" @click="showPriceModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Actualizar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- History Modal -->
    <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal-content history-modal">
        <div class="modal-header">
          <h2>Historial Stock: {{ historyProduct?.name }}</h2>
          <button @click="showHistoryModal = false" class="close-button">×</button>
        </div>
        
        <div v-if="historyLogs.length === 0" class="empty-history">
          No hay cambios recientes.
        </div>
        
        <table v-else class="history-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cambio</th>
              <th>Nuevo Stock</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in historyLogs" :key="log._id">
              <td class="date-cell">{{ formatDate(log.date) }}</td>
              <td :class="log.change >= 0 ? 'positive' : 'negative'">
                {{ log.change > 0 ? '+' : '' }}{{ log.change }}
              </td>
              <td>{{ log.newStock }}</td>
              <td>{{ log.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sales Stats Modal (Trainer View) -->
    <div v-if="showSalesStatsModal" class="modal-overlay" @click.self="showSalesStatsModal = false">
      <div class="modal-content history-modal">
        <div class="modal-header">
          <h2>Resumen Ventas: {{ historyProduct?.name }}</h2>
          <button @click="showSalesStatsModal = false" class="close-button">×</button>
        </div>
        
        <div v-if="!salesStats" class="loading">Cargando estadísticas...</div>
        
        <div v-else class="stats-container">
          <div class="total-sold-card">
             <h3>Total Vendido</h3>
             <p class="big-number">{{ salesStats.totalSold }} <span class="unit">unidades</span></p>
          </div>

          <div class="breakdown-section">
            <h3>Desglose por Entrenador</h3>
            <div v-if="salesStats.breakdown.length === 0" class="empty-history">
              No hay ventas registradas.
            </div>
            <table v-else class="history-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in salesStats.breakdown" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td class="positive">{{ item.quantity }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="breakdown-section" style="margin-top: 20px;">
            <h3>Historial de Ventas</h3>
            <div v-if="salesStats.salesLog.length === 0" class="empty-history">
              No hay ventas registradas.
            </div>
            <table v-else class="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th>Cantidad</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in salesStats.salesLog" :key="log._id">
                  <td class="date-cell">{{ formatDate(log.date) }}</td>
                  <td>{{ log.sellerName }}</td>
                  <td class="positive">{{ log.quantity }}</td>
                  <td class="price-cell">{{ formatPrice(log.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- General Sales Stats Modal (Admin Only) -->
    <div v-if="showGeneralStatsModal" class="modal-overlay" @click.self="showGeneralStatsModal = false">
      <div class="modal-content history-modal">
        <div class="modal-header centered">
          <h2>Estadísticas Generales de Ventas</h2>
          <button @click="showGeneralStatsModal = false" class="close-button">×</button>
        </div>

        <div class="modal-body">
        <div class="stats-filter-row">
            <div class="form-group">
                <label>Desde:</label>
                <input type="date" v-model="statsDateRange.start">
            </div>
            <div class="form-group">
                <label>Hasta:</label>
                <input type="date" v-model="statsDateRange.end">
            </div>
            <button @click="loadGeneralStats" class="submit-button" style="margin-top: auto; padding: 10px;">Filtrar</button>
        </div>

        <div v-if="isLoadingStats" class="loading">Cargando...</div>

        <div v-else-if="generalStats" class="stats-container">
            <div class="total-sold-card">
              <h3>Recaudación Total</h3>
              <p class="big-number">{{ formatPrice(generalStats.totalRevenue) }}</p>
              <p class="small-text">{{ generalStats.totalSalesCount }} ventas registradas</p>
            </div>

            <div class="breakdown-section">
            <h3>Detalle por Vendedor</h3>
            <div v-if="generalStats.breakdown.length === 0" class="empty-history">
                No hay ventas en este periodo.
            </div>
            <div v-else class="table-scroll-container">
            <table class="history-table">
                <thead>
                <tr>
                    <th>Vendedor</th>
                    <th>Ventas</th>
                    <th>Recaudado</th>
                </tr>
                </thead>
                <tbody>
                <template v-for="item in generalStats.breakdown" :key="item.name">
                    <tr>
                        <td>
                            <button @click="toggleSeller(item.name)" class="expand-button">
                                {{ expandedSellers.includes(item.name) ? '▼' : '▶' }}
                            </button>
                            {{ item.name }}
                        </td>
                        <td class="positive">{{ item.salesCount }}</td>
                        <td class="price-cell">{{ formatPrice(item.revenue) }}</td>
                    </tr>
                    <tr v-if="expandedSellers.includes(item.name)" class="details-row">
                        <td colspan="3">
                            <div class="product-details-container">
                                <table class="details-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Cant.</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="prod in item.products" :key="prod.name">
                                            <td>{{ prod.name }}</td>
                                            <td>{{ prod.quantity }}</td>
                                            <td>{{ formatPrice(prod.revenue) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </template>
                </tbody>
            </table>
            </div>
            </div>
        </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.admin-sales-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-sales-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  background-color: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  border: 2px solid var(--potenza-black);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

.logo-small {
  width: 50px;
  height: 50px;
}

h1 {
  color: var(--header-text);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0;
}

.create-button {
  background: linear-gradient(135deg, var(--potenza-yellow) 0%, #FFA500 100%);
  color: var(--potenza-dark-grey);
  border: 2px solid var(--potenza-black);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

/* Table Layout */
.products-list-container {
  overflow-x: auto;
  background: var(--card-bg);
  border-radius: 16px;
  border: 2px solid var(--potenza-yellow);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.products-table th {
  text-align: left;
  padding: 16px;
  background-color: var(--input-bg);
  color: var(--header-text);
  font-weight: 700;
  border-bottom: 2px solid var(--potenza-yellow);
}

.products-table td {
  padding: 16px;
  border-bottom: 1px solid var(--input-border);
  color: var(--text-color);
  vertical-align: middle;
}

.products-table tr:last-child td {
  border-bottom: none;
}

.product-name {
  font-weight: 600;
  color: var(--header-text);
  font-size: 1rem;
}

.product-category {
  font-size: 0.8rem;
  color: var(--subtitle-text);
}

.price-cell {
  font-weight: 700;
  color: var(--header-text);
}

.stock-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  font-size: 0.9rem;
  font-weight: 500;
}

.stock-badge.low-stock {
  background-color: #fef08a; /* yellow-200 */
  color: #854d0e; /* yellow-800 */
  border-color: #eab308;
}

.stock-badge.out-stock {
  background-color: #fecaca; /* red-200 */
  color: #991b1b; /* red-800 */
  border-color: #ef4444;
}

.actions-cell {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sell-button-small {
  background-color: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  border: 2px solid var(--potenza-black);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.sell-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stock-button-small {
  background-color: var(--input-bg);
  border: 1px solid var(--potenza-yellow);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
}

.stock-button-small:hover {
  background-color: var(--potenza-yellow);
  border-color: var(--potenza-black);
  transform: translateY(-1px);
}

.price-button-small {
  background-color: #dcfce7; /* green-100 */
  color: #166534; /* green-800 */
  border: 1px solid #22c55e;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-button {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  min-height: 38px;
  width: 38px;
}

.icon-button:hover {
  border-color: var(--potenza-yellow);
  background-color: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  transform: translateY(-1px);
}

.icon-button.delete:hover {
  border-color: #ef4444;
  background-color: #fee2e2;
}

[data-theme="dark"] .icon-button.delete:hover {
  background-color: #450a0a;
}

.history-link {
  background: none;
  border: none;
  color: var(--potenza-yellow);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0;
}

.history-link:hover {
  filter: brightness(1.2);
}


.history-modal {
  max-width: 600px;
  width: 95%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.modal-header {
  padding: 24px;
  background: var(--card-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--input-border);
  z-index: 10;
}

.modal-header.centered {
  flex-direction: column;
  text-align: center;
  position: relative;
  padding-bottom: 16px;
}

.modal-header.centered h2 {
  margin: 0;
  width: 100%;
}

.modal-header.centered .close-button {
  position: absolute;
  top: 16px;
  right: 16px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center; /* Center children horizontally */
}

.modal-body > * {
  width: 100%; /* Ensure they take full width but honor their own constraints */
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.history-table th {
  text-align: left;
  border-bottom: 2px solid var(--potenza-yellow);
  padding: 8px;
  font-size: 0.9rem;
  color: var(--header-text);
}

.history-table td {
  border-bottom: 1px solid var(--input-border);
  padding: 8px;
  font-size: 0.9rem;
  color: var(--text-color);
}

.date-cell {
  font-size: 0.8rem;
  color: var(--subtitle-text);
}

.positive {
  color: #16a34a;
  font-weight: 600;
}

.negative {
  color: #dc2626;
  font-weight: 600;
}

.empty-history {
  text-align: center;
  color: var(--subtitle-text);
  padding: 40px 20px;
  font-style: italic;
  width: 100%;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 450px;
  border: 2px solid var(--potenza-yellow);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  color: var(--header-text);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--header-text);
  cursor: pointer;
  line-height: 1;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: var(--header-text);
  font-weight: 600;
}

.form-group input {
  padding: 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 1rem;
  width: 100%;
}

.form-group.row {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0; /* Prevents flex overflow */
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button {
  flex: 1;
  background: var(--card-bg);
  border: 2px solid var(--potenza-black);
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--header-text);
  font-weight: 600;
}

.submit-button {
  flex: 1;
  background: linear-gradient(135deg, var(--potenza-yellow) 0%, #FFA500 100%);
  border: 2px solid var(--potenza-black);
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--potenza-dark-grey);
  font-weight: 700;
}

.product-summary {
  background: var(--input-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
}

.product-summary h3 {
  margin: 0 0 8px 0;
  color: var(--header-text);
}

.product-summary p {
  margin: 4px 0;
  color: var(--subtitle-text);
  font-size: 0.9rem;
}

.total-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--header-text);
  padding: 12px 0;
  border-top: 1px solid var(--input-border);
}

.total-amount {
  color: var(--potenza-yellow);
}

.loading, .empty-state {
  text-align: center;
  color: var(--subtitle-text);
  padding: 40px;
  font-size: 1.1rem;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.total-sold-card {
  background: var(--input-bg);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid var(--potenza-yellow);
}

.total-sold-card h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: var(--subtitle-text);
}

.big-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--header-text);
  margin: 0;
}

.unit {
  font-size: 1.1rem;
  color: var(--subtitle-text);
  font-weight: 500;
  margin-left: 8px;
}

.breakdown-section h3 {
  font-size: 1.1rem;
  color: var(--header-text);
  margin-bottom: 12px;
}

.stats-button {
  background: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  border: 2px solid var(--potenza-yellow);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

.stats-filter-row {
    display: flex;
    gap: 16px;
    background: var(--input-bg);
    padding: 16px;
    border-radius: 12px;
    align-items: flex-end;
    justify-content: center;
    border: 1px solid var(--input-border);
    flex-wrap: wrap;
}

.stats-filter-row .form-group {
    flex: 1;
    min-width: 140px;
}

.small-text {
    font-size: 0.9rem;
    color: var(--subtitle-text);
    margin-top: 4px;
}

.expand-button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--potenza-yellow);
    font-size: 0.8rem;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    padding: 0;
}

.details-row td {
    background-color: var(--input-bg);
    padding: 0 !important;
}

.product-details-container {
    padding: 10px 20px;
}

.details-table {
    width: 100%;
    font-size: 0.85rem;
}

.details-table th {
    color: var(--subtitle-text);
    border-bottom: 1px solid var(--input-border);
    padding: 4px;
    font-weight: 600;
}

.details-table td {
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 4px;
    color: var(--text-color);
}

@media (max-width: 768px) {
  .stats-filter-row {
      flex-direction: column;
      align-items: stretch;
  }

  .form-group input {
      width: 100%;
      box-sizing: border-box; /* Prevent padding from adding to width */
  }

  .submit-button {
      margin-top: 10px !important;
      width: 100%;
  }

  .history-modal {
      width: 95%;
      padding: 0;
      max-height: 85vh;
  }

  .history-table th, .history-table td {
      padding: 8px 4px;
      font-size: 0.85rem;
  }

  .table-scroll-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
  }
}
</style>
