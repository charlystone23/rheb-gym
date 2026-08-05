<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue"
import { useRouter } from "vue-router"
import DateField from "../components/DateField.vue"
import { MongoService } from "../services/mongoService"
import { displayToNativeDate, formatDateInput, formatDateTimeAR, getMonthRangeDisplay, parseDisplayDate } from "../utils/date"

const router = useRouter()
const products = ref([])
const isLoading = ref(false)
const error = ref("")
const currentUser = ref(null)

// Search & Filters
const searchQuery = ref("")
const selectedCategory = ref("TODAS")

// Modals state
const showProductModal = ref(false)
const showSaleModal = ref(false)
const showStockModal = ref(false)
const showPriceModal = ref(false)
const showHistoryModal = ref(false)
const isEditing = ref(false)

// Forms data
const productForm = ref({
  id: null,
  nombre: "",
  codigoBarras: "",
  descripcion: "",
  precioVenta: 0,
  precioCosto: 0,
  stockActual: 0,
  stockMinimo: 5,
  categoria: "General",
  activo: true
})

const saleForm = ref({
  product: null,
  productName: "",
  precioVenta: 0,
  quantity: 1,
  maxStock: 0,
  metodoPago: "EFECTIVO"
})

const saleTotal = computed(() => {
  return saleForm.value.precioVenta * saleForm.value.quantity
})

// Stock Adjustment Form
const stockForm = ref({
  product: null,
  productName: "",
  currentStock: 0,
  newStock: 0,
  razon: "",
  tipoMovimiento: "AJUSTE_MANUAL"
})

// Price Update Form
const priceForm = ref({
  id: null,
  name: "",
  currentPrice: 0,
  newPrice: 0
})

const historyMovements = ref([])
const historyProduct = ref(null)
const salesStats = ref(null)
const showSalesStatsModal = ref(false)

const isAdmin = computed(() => {
  const role = currentUser.value?.role?.toUpperCase()
  return role === 'ADMIN'
})

const canManageProducts = computed(() => {
  const role = currentUser.value?.role?.toUpperCase()
  return role === 'ADMIN' || role === 'ADMIN_VENTAS'
})

// Categories
const categories = computed(() => {
  const cats = new Set(products.value.map(p => p.categoria || p.category || 'General'))
  return ['TODAS', ...Array.from(cats)]
})

// Low Stock Alert List
const lowStockProducts = computed(() => {
  return products.value.filter(p => {
    const stock = p.stockActual !== undefined ? p.stockActual : (p.stock || 0)
    const min = p.stockMinimo !== undefined ? p.stockMinimo : 5
    return stock <= min
  })
})

// Filtered Products List
const filteredProducts = computed(() => {
  return products.value.filter(p => {
    const name = (p.nombre || p.name || '').toLowerCase()
    const barcode = (p.codigoBarras || p.barcode || '').toLowerCase()
    const cat = p.categoria || p.category || 'General'
    const q = searchQuery.value.toLowerCase()

    const matchesSearch = name.includes(q) || barcode.includes(q)
    const matchesCategory = selectedCategory.value === 'TODAS' || cat === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})

// --- Barcode Scanner Handler ---
let barcodeBuffer = ""
let barcodeTimer = null

function handleKeyDown(e) {
  const activeTag = document.activeElement?.tagName
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
    return
  }

  if (e.key === 'Enter') {
    if (barcodeBuffer.trim().length >= 3) {
      handleBarcodeScan(barcodeBuffer.trim())
    }
    barcodeBuffer = ""
    return
  }

  if (e.key.length === 1) {
    barcodeBuffer += e.key
    clearTimeout(barcodeTimer)
    barcodeTimer = setTimeout(() => {
      barcodeBuffer = ""
    }, 120)
  }
}

async function handleBarcodeScan(code) {
  const found = products.value.find(p => p.codigoBarras === code)
  if (found) {
    openSaleModal(found)
  } else {
    const remoteProd = await MongoService.searchProduct(code)
    if (remoteProd) {
      openSaleModal(remoteProd)
    } else {
      alert(`⚠️ Código de barras "${code}" no encontrado en el sistema.`)
    }
  }
}

onMounted(() => {
  const userStr = localStorage.getItem("user")
  if (userStr) {
    currentUser.value = JSON.parse(userStr)
  }
  loadProducts()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
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
  if (isAdmin.value || canManageProducts.value) {
    router.push("/admin")
  } else {
    router.push("/dashboard")
  }
}

// --- Product Management ---
function openCreateModal() {
  isEditing.value = false
  productForm.value = {
    nombre: "",
    codigoBarras: "",
    descripcion: "",
    precioVenta: 0,
    precioCosto: 0,
    stockActual: 0,
    stockMinimo: 5,
    categoria: "General",
    activo: true
  }
  showProductModal.value = true
}

function openEditModal(product) {
  isEditing.value = true
  productForm.value = {
    id: product._id,
    nombre: product.nombre || product.name,
    codigoBarras: product.codigoBarras || "",
    descripcion: product.descripcion || "",
    precioVenta: product.precioVenta !== undefined ? product.precioVenta : (product.price || 0),
    precioCosto: product.precioCosto !== undefined ? product.precioCosto : 0,
    stockActual: product.stockActual !== undefined ? product.stockActual : (product.stock || 0),
    stockMinimo: product.stockMinimo !== undefined ? product.stockMinimo : 5,
    categoria: product.categoria || product.category || "General",
    activo: product.activo !== undefined ? product.activo : true
  }
  showProductModal.value = true
}

async function saveProduct() {
  try {
    if (!productForm.value.nombre.trim()) {
      alert("El nombre del producto es obligatorio.")
      return
    }
    if (isEditing.value) {
      await MongoService.updateProduct(productForm.value.id, productForm.value, currentUser.value)
    } else {
      await MongoService.createProduct(productForm.value, currentUser.value)
    }
    showProductModal.value = false
    loadProducts()
  } catch (e) {
    alert("Error al guardar producto: " + e.message)
  }
}

async function deleteProduct(id) {
  if (!confirm("⚠️ ¡ADVERTENCIA! \n\n¿Estás seguro de que deseas eliminar este producto?\n\nEsta acción no se puede deshacer.")) return
  try {
    await MongoService.deleteProduct(id, currentUser.value)
    loadProducts()
  } catch (e) {
    alert("Error al eliminar: " + e.message)
  }
}

// --- Stock Adjustment ---
function openStockModal(product) {
  const currentStockVal = product.stockActual !== undefined ? product.stockActual : (product.stock || 0)
  stockForm.value = {
    product: product._id,
    productName: product.nombre || product.name,
    currentStock: currentStockVal,
    newStock: currentStockVal,
    razon: "",
    tipoMovimiento: "AJUSTE_MANUAL"
  }
  showStockModal.value = true
}

async function updateStock() {
  if (!stockForm.value.razon || !stockForm.value.razon.trim()) {
    alert("⚠️ El motivo del ajuste es OBLIGATORIO para garantizar la trazabilidad del inventario.")
    return
  }
  try {
    await MongoService.adjustStock(
      stockForm.value.product,
      {
        cantidadNueva: Number(stockForm.value.newStock),
        razon: stockForm.value.razon.trim(),
        tipoMovimiento: stockForm.value.tipoMovimiento,
        usuarioId: currentUser.value?._id
      }
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
  const currentPriceVal = product.precioVenta !== undefined ? product.precioVenta : (product.price || 0)
  priceForm.value = {
    id: product._id,
    name: product.nombre || product.name,
    currentPrice: currentPriceVal,
    newPrice: currentPriceVal
  }
  showPriceModal.value = true
}

async function updatePriceOnly() {
  if (priceForm.value.newPrice < 0) {
    alert("El precio no puede ser negativo")
    return
  }
  try {
    await MongoService.updateProduct(priceForm.value.id, {
      precioVenta: priceForm.value.newPrice,
      price: priceForm.value.newPrice
    }, currentUser.value)
    showPriceModal.value = false
    alert("Precio actualizado exitosamente")
    loadProducts()
  } catch (e) {
    alert("Error al actualizar precio: " + e.message)
  }
}

// --- History & Stats ---
const showGeneralStatsModal = ref(false)
const generalStats = ref(null)
const expandedSellers = ref([])
const today = new Date()
const statsDateRange = ref(getMonthRangeDisplay(today.getFullYear(), today.getMonth()))
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
    const startDate = parseDisplayDate(statsDateRange.value.start)
    const endDate = parseDisplayDate(statsDateRange.value.end)

    if (!startDate || !endDate) {
      alert("Ingresá un rango válido en formato dd/mm/aaaa")
      return
    }

    isLoadingStats.value = true
    generalStats.value = await MongoService.getGeneralSalesStats(
      displayToNativeDate(statsDateRange.value.start),
      displayToNativeDate(statsDateRange.value.end)
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
  
  if (canManageProducts.value) {
    historyMovements.value = []
    showHistoryModal.value = true
    try {
      historyMovements.value = await MongoService.getStockMovements(product._id)
    } catch (e) {
      console.error("Error fetching stock movements:", e)
    }
  } else {
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
  return formatDateTimeAR(date)
}

function updateStatsDateRange(field, value) {
  statsDateRange.value[field] = formatDateInput(value)
}

// --- Sales Management ---
function openSaleModal(product) {
  const currentStock = product.stockActual !== undefined ? product.stockActual : (product.stock || 0)
  if (currentStock <= 0) {
    alert("⚠️ No hay stock disponible para este producto.")
    return
  }
  saleForm.value = {
    product: product._id,
    productName: product.nombre || product.name,
    precioVenta: product.precioVenta !== undefined ? product.precioVenta : (product.price || 0),
    quantity: 1,
    maxStock: currentStock,
    metodoPago: "EFECTIVO"
  }
  showSaleModal.value = true
}

async function registerSale() {
  try {
    const saleData = {
      items: [{
        productoId: saleForm.value.product,
        cantidad: saleForm.value.quantity,
        precioUnitario: saleForm.value.precioVenta
      }],
      total: saleTotal.value,
      metodoPago: saleForm.value.metodoPago,
      usuarioId: currentUser.value ? (currentUser.value._id || currentUser.value.id) : null
    }
    
    await MongoService.createSale(saleData)
    showSaleModal.value = false
    alert("✅ Venta registrada con éxito")
    loadProducts()
  } catch (e) {
    alert("Error al registrar venta: " + e.message)
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0)
}
</script>

<template>
  <div class="admin-sales-container">
    <div class="admin-sales-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Ventas e Inventario (POS)</h1>
          <p class="subtitle">Control de stock, trazabilidad y cobro de productos</p>
        </div>
      </div>
      <div class="header-actions">
        <button v-if="canManageProducts" @click="openCreateModal" class="create-button">+ Nuevo Producto</button>
        <button v-if="canManageProducts" @click="openGeneralStatsModal" class="stats-button">📊 Estadísticas</button>
      </div>
    </div>

    <!-- Low Stock Alert Banner -->
    <div v-if="lowStockProducts.length > 0" class="low-stock-banner">
      <span class="alert-icon">⚠️</span>
      <div class="alert-content">
        <strong>Alerta de Bajo Stock:</strong>
        <span>{{ lowStockProducts.length }} producto(s) con stock igual o inferior al mínimo requerido.</span>
        <span class="low-stock-names">({{ lowStockProducts.map(p => p.nombre || p.name).join(', ') }})</span>
      </div>
    </div>

    <!-- Toolbar: Search & Barcode Detector & Filter -->
    <div class="toolbar-card">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input 
          v-model="searchQuery" 
          placeholder="Buscar por nombre o escanear código de barras..." 
          class="search-input"
        />
        <span class="barcode-indicator" title="El escáner de código de barras USB/Bluetooth está activo en segundo plano">
          🏷️ Escáner Activo
        </span>
      </div>
      <div class="filter-box">
        <label>Categoría:</label>
        <select v-model="selectedCategory" class="category-select">
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
    </div>

    <div class="content-area">
      <div v-if="isLoading" class="loading">Cargando catálogo e inventario...</div>
      
      <div v-else-if="filteredProducts.length === 0" class="empty-state">
        <p>No se encontraron productos que coincidan con la búsqueda.</p>
      </div>

      <div v-else class="products-list-container">
        <table class="products-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio Venta</th>
              <th>Stock Actual</th>
              <th>Acciones</th>
              <th>Trazabilidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in filteredProducts" :key="product._id">
              <td class="barcode-cell">
                <code>{{ product.codigoBarras || product.barcode || '-' }}</code>
              </td>
              <td>
                <div class="product-name">{{ product.nombre || product.name }}</div>
                <div class="product-desc" v-if="product.descripcion">{{ product.descripcion }}</div>
              </td>
              <td>
                <span class="category-tag">{{ product.categoria || product.category || 'General' }}</span>
              </td>
              <td class="price-cell">
                {{ formatPrice(product.precioVenta !== undefined ? product.precioVenta : product.price) }}
              </td>
              <td>
                <span 
                  class="stock-badge" 
                  :class="{ 
                    'low-stock': (product.stockActual !== undefined ? product.stockActual : product.stock) <= (product.stockMinimo || 5) && (product.stockActual !== undefined ? product.stockActual : product.stock) > 0, 
                    'out-stock': (product.stockActual !== undefined ? product.stockActual : product.stock) === 0 
                  }"
                >
                  {{ product.stockActual !== undefined ? product.stockActual : product.stock }} un.
                </span>
              </td>
              <td class="actions-cell">
                <button 
                  @click="openSaleModal(product)" 
                  class="sell-button-small" 
                  :disabled="(product.stockActual !== undefined ? product.stockActual : product.stock) === 0"
                >
                  Vender
                </button>
                <button v-if="canManageProducts" @click="openStockModal(product)" class="stock-button-small" title="Ajustar Stock (Trazabilidad)">📦 Stock</button>
                <button v-if="canManageProducts" @click="openPriceModal(product)" class="price-button-small" title="Actualizar Precio">$ Precio</button>
                <div v-if="canManageProducts" class="icon-actions">
                  <button @click="openEditModal(product)" class="icon-button" title="Editar">✏️</button>
                  <button @click="deleteProduct(product._id)" class="icon-button delete" title="Eliminar">🗑️</button>
                </div>
              </td>
              <td>
                <button @click="openHistoryModal(product)" class="history-link">
                  {{ canManageProducts ? 'Trazabilidad' : 'Ver ventas' }}
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
            <label>Nombre del Producto *</label>
            <input v-model="productForm.nombre" required placeholder="Ej. Proteína Whey 1kg" />
          </div>

          <div class="form-group row">
            <div class="col">
              <label>Código de Barras</label>
              <input v-model="productForm.codigoBarras" placeholder="Escanea o escribe..." />
            </div>
            <div class="col">
              <label>Categoría</label>
              <input v-model="productForm.categoria" placeholder="Ej. Suplementos, Bebidas..." />
            </div>
          </div>

          <div class="form-group row">
            <div class="col">
              <label>Precio Costo ($) *</label>
              <input type="number" step="0.01" v-model="productForm.precioCosto" required min="0" />
            </div>
            <div class="col">
              <label>Precio Venta ($) *</label>
              <input type="number" step="0.01" v-model="productForm.precioVenta" required min="0" />
            </div>
          </div>

          <div class="form-group row">
            <div class="col">
              <label>Stock Inicial *</label>
              <input type="number" v-model="productForm.stockActual" required min="0" />
            </div>
            <div class="col">
              <label>Stock Mínimo *</label>
              <input type="number" v-model="productForm.stockMinimo" required min="0" />
            </div>
          </div>

          <div class="form-group">
            <label>Descripción</label>
            <input v-model="productForm.descripcion" placeholder="Detalles o especificaciones opcionales" />
          </div>

          <div class="modal-actions">
            <button type="button" @click="showProductModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Guardar Producto</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Sale POS Modal -->
    <div v-if="showSaleModal" class="modal-overlay" @click.self="showSaleModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Registrar Venta POS</h2>
          <button @click="showSaleModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="registerSale" class="modal-form">
          <div class="product-summary">
            <h3>{{ saleForm.productName }}</h3>
            <p>Precio Unitario: <strong>{{ formatPrice(saleForm.precioVenta) }}</strong></p>
            <p>Stock Disponible: <strong>{{ saleForm.maxStock }} un.</strong></p>
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

          <div class="form-group">
            <label>Método de Pago *</label>
            <select v-model="saleForm.metodoPago" required class="form-select">
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="MERCADO_PAGO">📱 Mercado Pago</option>
              <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
              <option value="DEBITO">💳 Tarjeta de Débito</option>
              <option value="CREDITO">💳 Tarjeta de Crédito</option>
            </select>
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
          <h2>Ajuste de Inventario (Trazabilidad)</h2>
          <button @click="showStockModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="updateStock" class="modal-form">
          <div class="product-summary">
            <h3>{{ stockForm.productName }}</h3>
            <p>Stock Actual en Sistema: <strong>{{ stockForm.currentStock }} un.</strong></p>
          </div>
          
          <div class="form-group row">
            <div class="col">
              <label>Nuevo Stock Total</label>
              <input type="number" v-model="stockForm.newStock" required min="0" />
            </div>
            <div class="col">
              <label>Tipo de Movimiento</label>
              <select v-model="stockForm.tipoMovimiento" class="form-select">
                <option value="ENTRADA">📦 ENTRADA (Reabastecimiento)</option>
                <option value="AJUSTE_MANUAL">✏️ AJUSTE MANUAL</option>
                <option value="MERMA_PERDIDA">⚠️ MERMA / PERDIDA</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Motivo del Ajuste (Obligatorio) *</label>
            <input 
              v-model="stockForm.razon" 
              required 
              placeholder="Ej. Ingreso de proveedor, Rotura, Recuento físico..." 
            />
          </div>

          <div class="modal-actions">
            <button type="button" @click="showStockModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Registrar Movimiento</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Price Update Modal -->
    <div v-if="showPriceModal" class="modal-overlay" @click.self="showPriceModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Actualizar Precio de Venta</h2>
          <button @click="showPriceModal = false" class="close-button">×</button>
        </div>
        <form @submit.prevent="updatePriceOnly" class="modal-form">
          <div class="product-summary">
            <h3>{{ priceForm.name }}</h3>
            <p>Precio Actual: {{ formatPrice(priceForm.currentPrice) }}</p>
          </div>
          
          <div class="form-group">
             <label>Nuevo Precio de Venta ($)</label>
             <input type="number" step="0.01" v-model="priceForm.newPrice" required min="0" />
          </div>

          <div class="modal-actions">
            <button type="button" @click="showPriceModal = false" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button">Actualizar Precio</button>
          </div>
        </form>
      </div>
    </div>

    <!-- History / StockMovement Modal -->
    <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal-content history-modal">
        <div class="modal-header">
          <h2>Trazabilidad de Stock: {{ historyProduct?.nombre || historyProduct?.name }}</h2>
          <button @click="showHistoryModal = false" class="close-button">×</button>
        </div>
        
        <div v-if="historyMovements.length === 0" class="empty-history">
          No hay movimientos de stock registrados para este producto.
        </div>
        
        <div v-else class="table-scroll-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Cambio</th>
                <th>Nuevo Stock</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mov in historyMovements" :key="mov._id">
                <td class="date-cell">{{ formatDate(mov.fechaHora || mov.createdAt) }}</td>
                <td>{{ mov.usuarioId?.nombre || mov.usuarioId?.username || 'Sistema' }}</td>
                <td>
                  <span class="movement-tag" :class="mov.tipoMovimiento">
                    {{ mov.tipoMovimiento }}
                  </span>
                </td>
                <td :class="mov.cantidadCambio >= 0 ? 'positive' : 'negative'">
                  {{ mov.cantidadCambio > 0 ? '+' : '' }}{{ mov.cantidadCambio }}
                </td>
                <td><strong>{{ mov.cantidadNueva }}</strong></td>
                <td>{{ mov.razon }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Sales Stats Modal (Trainer View) -->
    <div v-if="showSalesStatsModal" class="modal-overlay" @click.self="showSalesStatsModal = false">
      <div class="modal-content history-modal">
        <div class="modal-header">
          <h2>Resumen Ventas: {{ historyProduct?.nombre || historyProduct?.name }}</h2>
          <button @click="showSalesStatsModal = false" class="close-button">×</button>
        </div>
        
        <div v-if="!salesStats" class="loading">Cargando estadísticas...</div>
        
        <div v-else class="stats-container">
          <div class="total-sold-card">
             <h3>Total Vendido</h3>
             <p class="big-number">{{ salesStats.totalSold }} <span class="unit">unidades</span></p>
          </div>

          <div class="breakdown-section">
            <h3>Desglose por Vendedor</h3>
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
                <DateField
                  :model-value="statsDateRange.start"
                  input-id="sales-stats-start"
                  @update:model-value="value => updateStatsDateRange('start', value)"
                />
            </div>
            <div class="form-group">
                <label>Hasta:</label>
                <DateField
                  :model-value="statsDateRange.end"
                  input-id="sales-stats-end"
                  @update:model-value="value => updateStatsDateRange('end', value)"
                />
            </div>
            <button @click="loadGeneralStats" class="submit-button" style="margin-top: auto; padding: 10px;">Filtrar</button>
          </div>

          <div v-if="isLoadingStats" class="loading">Cargando...</div>

          <div v-else-if="generalStats" class="stats-container">
            <div class="total-sold-card">
              <h3>Recaudación Total (Productos POS)</h3>
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
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.back-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
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
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

/* Banner de Alerta Stock Mínimo */
.low-stock-banner {
  background-color: #fef2f2;
  border: 2px solid #ef4444;
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  color: #991b1b;
}

[data-theme="dark"] .low-stock-banner {
  background-color: #450a0a;
  border-color: #f87171;
  color: #fca5a5;
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-content {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 0.95rem;
}

.low-stock-names {
  font-style: italic;
  opacity: 0.9;
}

/* Toolbar & Scanner */
.toolbar-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--input-border);
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 280px;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 8px;
  padding: 6px 12px;
}

.search-input {
  border: none;
  background: transparent;
  width: 100%;
  color: var(--text-color);
  font-size: 0.95rem;
  outline: none;
}

.barcode-indicator {
  font-size: 0.75rem;
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
  white-space: nowrap;
}

.filter-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-box label {
  font-weight: 600;
  color: var(--header-text);
  font-size: 0.9rem;
}

.category-select, .form-select {
  padding: 10px;
  border-radius: 8px;
  border: 2px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-color);
  font-size: 0.95rem;
  outline: none;
}

/* Table Layout */
.products-list-container {
  overflow-x: auto;
  background: var(--card-bg);
  border-radius: 16px;
  border: 2px solid var(--rheb-primary-green);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 750px;
}

.products-table th {
  text-align: left;
  padding: 16px;
  background-color: var(--input-bg);
  color: var(--header-text);
  font-weight: 700;
  border-bottom: 2px solid var(--rheb-primary-green);
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

.barcode-cell code {
  background: var(--input-bg);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
  border: 1px dashed var(--input-border);
}

.product-name {
  font-weight: 600;
  color: var(--header-text);
  font-size: 1rem;
}

.product-desc {
  font-size: 0.8rem;
  color: var(--subtitle-text);
  margin-top: 2px;
}

.category-tag {
  background: var(--input-bg);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--subtitle-text);
  border: 1px solid var(--input-border);
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
  font-weight: 600;
}

.stock-badge.low-stock {
  background-color: #fef08a;
  color: #854d0e;
  border-color: #eab308;
}

.stock-badge.out-stock {
  background-color: #fecaca;
  color: #991b1b;
  border-color: #ef4444;
}

.actions-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sell-button-small {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.sell-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stock-button-small {
  background-color: var(--input-bg);
  border: 1px solid var(--rheb-primary-green);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.price-button-small {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #22c55e;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.icon-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.icon-button {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  font-size: 1rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  width: 34px;
}

.icon-button:hover {
  border-color: var(--rheb-primary-green);
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
}

.icon-button.delete:hover {
  border-color: #ef4444;
  background-color: #fee2e2;
}

.history-link {
  background: none;
  border: none;
  color: var(--rheb-primary-green);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
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
  max-width: 480px;
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
  gap: 6px;
}

.form-group label {
  color: var(--header-text);
  font-weight: 600;
  font-size: 0.9rem;
}

.form-group input, .form-group select {
  padding: 10px 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 1rem;
  width: 100%;
  background: var(--input-bg);
  color: var(--text-color);
  box-sizing: border-box;
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
  gap: 6px;
  min-width: 0;
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
  margin: 0 0 6px 0;
  color: var(--header-text);
}

.product-summary p {
  margin: 2px 0;
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

.history-modal {
  max-width: 680px;
  width: 95%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.table-scroll-container {
  overflow-x: auto;
  padding: 0 16px 16px 16px;
}

.movement-tag {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
}

.movement-tag.ENTRADA { background: #dcfce7; color: #166534; }
.movement-tag.SALIDA_VENTA { background: #dbeafe; color: #1e40af; }
.movement-tag.MERMA_PERDIDA { background: #fee2e2; color: #991b1b; }
.movement-tag.AJUSTE_MANUAL { background: #fef3c7; color: #92400e; }

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
  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .form-group.row {
    flex-direction: column;
  }
}
</style>
