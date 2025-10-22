<template>
  <div class="inventory-viewer">
    <h1 v-if="!hideTitle">Inventory Management</h1>

    <!-- Search Controls -->
    <div class="search-controls" v-if="!hideSearchControls">
      <div class="search-section">
        <label>
          <span>Search Type:</span>
          <select v-model="searchType">
            <option value="available">View Available</option>
            <option value="checked-out">View Checked Out</option>
            <option value="expired">View Expired</option>
            <option value="item">Search by Item Name</option>
            <option value="category">Search by Category</option>
            <option value="tag">Search by Tag</option>
            <option value="adjacent">AI: Similar Items</option>
            <option value="autocomplete">AI: Autocomplete</option>
            <option value="recommend">AI: Recommendations</option>
          </select>
        </label>
      </div>

      <div
        class="search-section"
        v-if="
          searchType !== 'available' &&
          searchType !== 'checked-out' &&
          searchType !== 'expired' &&
          searchType !== 'recommend'
        "
      >
        <label>
          <span>{{ getInputLabel() }}:</span>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="getInputPlaceholder()"
            @keyup.enter="handleSearch"
          />
        </label>
      </div>

      <div class="search-section" v-if="searchType === 'recommend'">
        <label>
          <span>Your Interests:</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="e.g., music practice, sports, photography..."
            @keyup.enter="handleSearch"
          />
        </label>
      </div>

      <div class="search-section">
        <button @click="handleSearch" :disabled="loading" class="btn-primary">
          {{ loading ? 'Loading...' : 'Search' }}
        </button>
        <button @click="clearResults" class="btn-secondary">Clear</button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Action Success Message -->
    <div v-if="actionSuccess" class="success-message">
      {{ actionSuccess }}
    </div>

    <!-- Results Count -->
    <div v-if="items.length > 0" class="results-info">
      Found {{ items.length }} item{{ items.length !== 1 ? 's' : '' }}
    </div>

    <!-- Table -->
    <div v-if="items.length > 0" class="table-container">
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Available</th>
            <th>Last Checkout</th>
            <th>Last Kerb</th>
            <th>Categories</th>
            <th>Tags</th>
            <th>Checkout</th>
            <th>Checkin</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in items"
            :key="index"
            :class="{ unavailable: !item.available, updated: highlighted[item.itemName] }"
          >
            <td class="item-name">{{ item.itemName }}</td>
            <td>
              <span :class="['status-badge', item.available ? 'available' : 'unavailable']">
                {{ item.available ? '✓ Available' : '✗ Unavailable' }}
              </span>
            </td>
            <td>{{ item.lastCheckout || 'Never' }}</td>
            <td>{{ item.lastKerb || 'N/A' }}</td>
            <td>
              <div class="tag-list">
                <span v-for="category in item.categories" :key="category" class="tag category">
                  {{ category }}
                </span>
              </div>
            </td>
            <td>
              <div class="tag-list">
                <span v-for="tag in item.tags" :key="tag" class="tag">
                  {{ tag }}
                </span>
              </div>
            </td>
            <td>
              <div class="action-cell">
                <input
                  v-model="checkoutKerbs[item.itemName]"
                  type="text"
                  placeholder="Enter kerb"
                  class="kerb-input"
                  :disabled="!item.available || processingItems.has(item.itemName)"
                />
                <button
                  @click="handleCheckout(item.itemName)"
                  :disabled="
                    !item.available ||
                    !checkoutKerbs[item.itemName]?.trim() ||
                    processingItems.has(item.itemName)
                  "
                  class="btn-action btn-checkout"
                >
                  {{
                    processingItems.has(item.itemName) && currentAction === 'checkout'
                      ? '...'
                      : 'Checkout'
                  }}
                </button>
              </div>
            </td>
            <td>
              <button
                @click="handleCheckin(item.itemName)"
                :disabled="item.available || processingItems.has(item.itemName)"
                class="btn-action btn-checkin"
              >
                {{
                  processingItems.has(item.itemName) && currentAction === 'checkin'
                    ? '...'
                    : 'Checkin'
                }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && !error" class="empty-state">
      <p>No items to display. Use the search controls above to find inventory items.</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, reactive } from 'vue'
import { apiFetch } from '../lib/api'
import { useInventoryEventsStore } from '../stores/inventoryEvents'

interface InventoryItem {
  itemName: string
  lastCheckout: string | null
  available: boolean
  lastKerb: string
  categories: string[]
  tags: string[]
}

const props = defineProps<{
  hideTitle?: boolean
  hideSearchControls?: boolean
  externalSearchType?:
    | 'available'
    | 'checked-out'
    | 'expired'
    | 'item'
    | 'category'
    | 'tag'
    | 'adjacent'
    | 'autocomplete'
    | 'recommend'
  externalSearchQuery?: string
  triggerSearch?: number
}>()

const emit = defineEmits<{
  'results-updated': [itemCount: number]
}>()

const searchType = ref<
  | 'available'
  | 'checked-out'
  | 'expired'
  | 'item'
  | 'category'
  | 'tag'
  | 'adjacent'
  | 'autocomplete'
  | 'recommend'
>(props.externalSearchType || 'available')
const searchQuery = ref(props.externalSearchQuery || '')
const items = ref<InventoryItem[]>([])
const loading = ref(false)
const error = ref('')
const actionSuccess = ref('')
const checkoutKerbs = reactive<Record<string, string>>({})
const processingItems = ref(new Set<string>())
const currentAction = ref<'checkout' | 'checkin' | ''>('')
const inventoryEvents = useInventoryEventsStore()
const highlighted = reactive<Record<string, boolean>>({})

// Watch for external prop changes
watch(
  () => props.externalSearchType,
  (newType) => {
    if (newType) {
      searchType.value = newType
    }
  },
)

watch(
  () => props.externalSearchQuery,
  (newQuery) => {
    if (newQuery !== undefined) {
      searchQuery.value = newQuery
    }
  },
)

watch(
  () => props.triggerSearch,
  () => {
    if (props.triggerSearch !== undefined) {
      handleSearch()
    }
  },
)

async function handleSearch() {
  loading.value = true
  error.value = ''
  actionSuccess.value = ''

  console.log('Starting search with type:', searchType.value, 'query:', searchQuery.value)

  try {
    // Helper to safely extract an array of items from various response shapes (already-parsed JSON)
    const parseItemsFromData = (data: unknown): InventoryItem[] => {
      const isObject = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null

      // Some backends return an array directly; others wrap it
      if (Array.isArray(data)) return data as InventoryItem[]
      if (isObject(data)) {
        type MaybeItems = { result?: unknown; items?: unknown; error?: unknown }
        const obj = data as MaybeItems
        if (Array.isArray(obj.result)) return obj.result as InventoryItem[]
        if (Array.isArray(obj.items)) return obj.items as InventoryItem[]
        if (typeof obj.error === 'string') throw new Error(String(obj.error))
      }
      // If server returned a string (e.g., error message), surface it
      if (typeof data === 'string') {
        throw new Error(data)
      }
      console.warn('Unexpected response shape from Viewer API:', data)
      return []
    }

    let result: InventoryItem[]

    switch (searchType.value) {
      case 'available':
        console.log('Fetching available items')
        {
          const data = await apiFetch<unknown>('/Viewer/viewAvailable', {
            method: 'POST',
            json: true,
          })
          result = parseItemsFromData(data)
        }
        break

      case 'checked-out':
        console.log('Fetching checked out items')
        {
          const data = await apiFetch<unknown>('/Viewer/viewCheckedOut', {
            method: 'POST',
            json: true,
          })
          result = parseItemsFromData(data)
        }
        break

      case 'expired':
        console.log('Fetching expired items')
        {
          const data = await apiFetch<unknown>('/Viewer/viewExpired', {
            method: 'POST',
            json: true,
          })
          result = parseItemsFromData(data)
        }
        break

      case 'item':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter an item name'
          loading.value = false
          return
        }
        console.log('Fetching item with body (JSON string):', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/viewItem', {
            method: 'POST',
            json: true,
            body: searchQuery.value.trim(),
          })
          result = parseItemsFromData(data)
        }
        break

      case 'category':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter a category'
          loading.value = false
          return
        }
        console.log('Fetching category with body (JSON string):', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/viewCategory', {
            method: 'POST',
            json: true,
            body: searchQuery.value.trim(),
          })
          result = parseItemsFromData(data)
        }
        break

      case 'tag':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter a tag'
          loading.value = false
          return
        }
        console.log('Fetching tag with body (JSON string):', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/viewTag', {
            method: 'POST',
            json: true,
            body: searchQuery.value.trim(),
          })
          result = parseItemsFromData(data)
        }
        break

      case 'adjacent':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter an item name'
          loading.value = false
          return
        }
        console.log('Fetching adjacent items with body:', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/viewAdjacent', {
            method: 'POST',
            json: true,
            body: { itemName: searchQuery.value.trim() },
          })
          result = parseItemsFromData(data)
        }
        break

      case 'autocomplete':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter a search prefix'
          loading.value = false
          return
        }
        console.log('Fetching autocomplete with body:', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/viewAutocomplete', {
            method: 'POST',
            json: true,
            body: { prefix: searchQuery.value.trim() },
          })
          result = parseItemsFromData(data)
        }
        break

      case 'recommend':
        if (!searchQuery.value.trim()) {
          error.value = 'Please enter your interests'
          loading.value = false
          return
        }
        console.log('Fetching recommendations with body:', searchQuery.value.trim())
        {
          const data = await apiFetch<unknown>('/Viewer/recommendItems', {
            method: 'POST',
            json: true,
            body: { interests: searchQuery.value.trim() },
          })
          result = parseItemsFromData(data)
        }
        break

      default:
        result = []
    }

    console.log('Search result (normalized array, length):', result, result?.length)
    items.value = result
    emit('results-updated', result.length)

    if (result.length === 0) {
      error.value = 'No items found'
    }
  } catch (err) {
    console.error('Search error:', err)
    error.value = err instanceof Error ? err.message : 'An error occurred while fetching data'
    items.value = []
    emit('results-updated', 0)
  } finally {
    loading.value = false
  }
}

async function handleCheckout(itemName: string) {
  const kerb = checkoutKerbs[itemName]?.trim()
  if (!kerb) return

  processingItems.value.add(itemName)
  currentAction.value = 'checkout'
  error.value = ''
  actionSuccess.value = ''

  try {
    // Send checkout data with json=true so apiFetch stringifies and parses
    await apiFetch<unknown>('/Reservation/checkoutItem', {
      method: 'POST',
      json: true,
      body: { kerb, item: itemName },
    })

    // Optimistically update the local table immediately
    const idx = items.value.findIndex((i) => i.itemName === itemName)
    if (idx !== -1) {
      const base = items.value[idx] as InventoryItem
      const updated: InventoryItem = {
        ...base,
        available: false,
        lastKerb: kerb,
        lastCheckout: new Date().toISOString(),
      }
      items.value.splice(idx, 1, updated)
    }

    actionSuccess.value = `Successfully checked out "${itemName}" to ${kerb}`
    highlightRow(itemName)
    checkoutKerbs[itemName] = ''

    // Fetch the latest record for this item to ensure DB is updated
    await refreshItemFromServer(itemName)

    // Also refresh the current result set to reflect any list-wide changes
    await handleSearch()

    // Notify other views to refresh (include itemName so they can highlight)
    inventoryEvents.bump('checkout', itemName)

    // Clear success message after 3 seconds
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3000)
  } catch (err) {
    console.error('Checkout error:', err)
    error.value =
      err instanceof Error ? err.message : `Failed to checkout "${itemName}". Please try again.`
  } finally {
    processingItems.value.delete(itemName)
    currentAction.value = ''
  }
}

async function handleCheckin(itemName: string) {
  processingItems.value.add(itemName)
  currentAction.value = 'checkin'
  error.value = ''
  actionSuccess.value = ''

  try {
    // Send checkin data with json=true so apiFetch stringifies and parses
    await apiFetch<unknown>('/Reservation/checkinItem', {
      method: 'POST',
      json: true,
      body: { itemName },
    })

    // Optimistically update the local table immediately
    const idx = items.value.findIndex((i) => i.itemName === itemName)
    if (idx !== -1) {
      const base = items.value[idx] as InventoryItem
      const updated: InventoryItem = {
        ...base,
        available: true,
      }
      items.value.splice(idx, 1, updated)
    }

    actionSuccess.value = `Successfully checked in "${itemName}"`
    highlightRow(itemName)

    // Fetch the latest record for this item to ensure DB is updated
    await refreshItemFromServer(itemName)

    // Also refresh the current result set to reflect any list-wide changes
    await handleSearch()

    // Notify other views to refresh (include itemName so they can highlight)
    inventoryEvents.bump('checkin', itemName)

    // Clear success message after 3 seconds
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3000)
  } catch (err) {
    console.error('Checkin error:', err)
    error.value =
      err instanceof Error ? err.message : `Failed to checkin "${itemName}". Please try again.`
  } finally {
    processingItems.value.delete(itemName)
    currentAction.value = ''
  }
}

function clearResults() {
  items.value = []
  searchQuery.value = ''
  error.value = ''
  actionSuccess.value = ''
  Object.keys(checkoutKerbs).forEach((key) => delete checkoutKerbs[key])
  emit('results-updated', 0)
}

// Fetch and update a single item from the server to confirm DB changes are reflected
async function refreshItemFromServer(itemName: string) {
  try {
    const data = await apiFetch<unknown>('/Viewer/viewItem', {
      method: 'POST',
      json: true,
      body: itemName,
    })
    const updatedItems = ((): InventoryItem[] => {
      const isObject = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null
      if (Array.isArray(data)) return data as InventoryItem[]
      if (isObject(data)) {
        const obj = data as { result?: unknown; items?: unknown }
        if (Array.isArray(obj.result)) return obj.result as InventoryItem[]
        if (Array.isArray(obj.items)) return obj.items as InventoryItem[]
      }
      return []
    })()

    if (updatedItems.length > 0) {
      const latest = updatedItems[0] as InventoryItem
      const idx = items.value.findIndex((i) => i.itemName === latest.itemName)
      if (idx !== -1) {
        items.value.splice(idx, 1, latest)
      }
    } else {
      // If we didn't get a record back, fallback to a full refresh
      await handleSearch()
    }
  } catch {
    // On error, fallback to a full refresh
    await handleSearch()
  }
}

function getInputLabel(): string {
  switch (searchType.value) {
    case 'item':
      return 'Item Name'
    case 'category':
      return 'Category'
    case 'tag':
      return 'Tag'
    case 'adjacent':
      return 'Item Name'
    case 'autocomplete':
      return 'Search Prefix'
    default:
      return 'Search'
  }
}

function getInputPlaceholder(): string {
  switch (searchType.value) {
    case 'item':
      return 'Enter item name...'
    case 'category':
      return 'Enter category...'
    case 'tag':
      return 'Enter tag...'
    case 'adjacent':
      return 'Enter item name to find similar items...'
    case 'autocomplete':
      return 'Start typing item name...'
    default:
      return 'Enter search...'
  }
}

function highlightRow(name: string) {
  highlighted[name] = true
  setTimeout(() => {
    delete highlighted[name]
  }, 1600)
}
</script>

<style scoped>
.inventory-viewer {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #2c3e50;
  margin-bottom: 30px;
}

.search-controls {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.search-section {
  display: flex;
  flex-direction: column;
}

.search-section label {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.search-section span {
  font-weight: 600;
  color: #1a1d20;
  font-size: 14px;
}

select,
input[type='text'] {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

select:focus,
input[type='text']:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.1);
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #42b983;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #359268;
}

.btn-primary:disabled {
  background-color: #95c9b4;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  margin-bottom: 20px;
}

.success-message {
  padding: 12px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
  margin-bottom: 20px;
  font-weight: 600;
}

.results-info {
  padding: 10px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
  margin-bottom: 20px;
  font-weight: 600;
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  color: #1a1d20;
  border-collapse: collapse;
  background-color: white;
}

th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

th {
  background-color: #2c3e50;
  color: white;
  font-weight: 600;
  position: sticky;
  top: 0;
}

tr:hover {
  background-color: #f8f9fa;
}

tr.unavailable {
  background-color: #fff3cd;
}

/* Subtle highlight when a row was just updated */
tr.updated {
  background-color: #e6ffed; /* soft green */
}

tr {
  transition: background-color 0.35s ease;
}

.item-name {
  font-weight: 600;
  color: #2c3e50;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.available {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.unavailable {
  background-color: #f8d7da;
  color: #721c24;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  display: inline-block;
  padding: 3px 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
}

.tag.category {
  background-color: #cfe2ff;
  color: #084298;
}

.action-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.kerb-input {
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  min-width: 120px;
}

.kerb-input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.btn-action {
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
}

.btn-checkout {
  background-color: #0d6efd;
  color: white;
}

.btn-checkout:hover:not(:disabled) {
  background-color: #0b5ed7;
}

.btn-checkout:disabled {
  background-color: #87a8ee;
  cursor: not-allowed;
}

.btn-checkin {
  background-color: #198754;
  color: white;
}

.btn-checkin:hover:not(:disabled) {
  background-color: #157347;
}

.btn-checkin:disabled {
  background-color: #8cc9aa;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-state p {
  font-size: 16px;
}
</style>
