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
                  v-has-any-flag.disable="['Houseteam', 'Desk']"
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
                v-has-any-flag.disable="['Houseteam', 'Desk']"
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
// Keep per-item snapshots to support optimistic UI with revert-on-error
const optimisticSnapshots = reactive<
  Record<string, { available: boolean; lastKerb: string; lastCheckout: string | null }>
>({})

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

// Auto-refresh when other views signal an inventory update
watch(
  () => inventoryEvents.version,
  async () => {
    // Only refresh if the user has already performed a search (has items displayed)
    // Skip if currently loading to avoid race conditions
    if (loading.value) return

    // If no items are displayed, there's nothing to refresh
    // (user hasn't searched yet or cleared results)
    if (items.value.length === 0) return

    const changed = inventoryEvents.lastItemName
    await handleSearch()
    if (changed) {
      highlightRow(changed)
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
        // Backend now returns empty lists rather than throwing for missing items
        if (typeof obj.error === 'string') {
          console.warn('Viewer API returned error string; treating as empty list:', obj.error)
          return []
        }
      }
      // If server returned a string (e.g., error message), surface it
      if (typeof data === 'string') {
        console.warn('Viewer API returned string response; treating as empty list:', data)
        return []
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
          // Handle sync-orchestrated response shape: { allowed: boolean, items?: [...] , error?: string }
          if (
            typeof data === 'object' &&
            data !== null &&
            'allowed' in (data as Record<string, unknown>)
          ) {
            const obj = data as { allowed?: boolean; items?: unknown; error?: unknown }
            if (obj.allowed === false) {
              error.value =
                typeof obj.error === 'string'
                  ? obj.error
                  : 'You are not authorized to view available items.'
              result = []
            } else {
              result = Array.isArray(obj.items) ? (obj.items as InventoryItem[]) : []
            }
          } else {
            result = parseItemsFromData(data)
          }
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

    if (!error.value && result.length === 0) {
      error.value = 'No items found'
    }
  } catch (err) {
    console.error('Search error:', err)
    const message = err instanceof Error ? err.message : ''

    // Make API errors more user-friendly
    if (message.includes('401') || message.includes('Unauthorized')) {
      error.value = 'Your session has expired. Please log in again.'
    } else if (message.includes('403') || message.includes('Forbidden')) {
      error.value = "You don't have permission to view this data."
    } else if (message.includes('404') || message.includes('Not Found')) {
      error.value = 'No items found. The inventory might be empty or unavailable.'
    } else if (message.includes('500') || message.includes('Internal Server')) {
      error.value = 'Server error. Please try again in a moment.'
    } else if (message.includes('Network') || message.includes('fetch')) {
      error.value = 'Connection issue. Check your internet and try again.'
    } else if (message) {
      error.value = message
    } else {
      error.value = 'Something went wrong. Please try again.'
    }

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

  // Apply optimistic update: mark unavailable and set kerb/checkout time immediately
  const idx = items.value.findIndex((i) => i.itemName === itemName)
  if (idx !== -1) {
    const item = items.value[idx]
    if (item) {
      optimisticSnapshots[itemName] = {
        available: item.available,
        lastKerb: item.lastKerb,
        lastCheckout: item.lastCheckout,
      }
      item.available = false
      item.lastKerb = kerb
      item.lastCheckout = new Date().toISOString()
    }
  }

  try {
    // Send checkout data with json=true so apiFetch stringifies and parses
    await apiFetch<unknown>('/Reservation/checkoutItem', {
      method: 'POST',
      json: true,
      body: { kerb, item: itemName },
    })

    actionSuccess.value = `Successfully checked out "${itemName}" to ${kerb}`
    checkoutKerbs[itemName] = ''

    // Successful response: clear optimistic snapshot for this item
    if (optimisticSnapshots[itemName]) delete optimisticSnapshots[itemName]

    // Notify other views to refresh (include itemName so they can highlight)
    // The event watcher will handle refreshing this table too
    inventoryEvents.bump('checkout', itemName)

    // Clear success message after 3 seconds
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3000)
  } catch (err) {
    console.error('Checkout error:', err)
    const message = err instanceof Error ? err.message : ''

    // Revert optimistic update on error
    const idx = items.value.findIndex((i) => i.itemName === itemName)
    const snap = optimisticSnapshots[itemName]
    if (idx !== -1 && snap) {
      const current = items.value[idx]
      if (current) {
        current.available = snap.available
        current.lastKerb = snap.lastKerb
        current.lastCheckout = snap.lastCheckout
      }
      delete optimisticSnapshots[itemName]
    }

    // Friendly checkout error messages
    if (message.includes('not found') || message.includes('does not exist')) {
      error.value = `Item "${itemName}" not found. It may have been removed.`
    } else if (message.includes('already checked out') || message.includes('unavailable')) {
      error.value = `"${itemName}" is already checked out. Please check in first.`
    } else if (message.includes('User') && message.includes('not found')) {
      error.value = `User "${kerb}" not found. Please check the kerb spelling.`
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      error.value = 'Your session expired. Please log in again.'
    } else if (message.includes('403') || message.includes('permission')) {
      error.value = "You don't have permission to checkout items."
    } else if (message) {
      error.value = `Checkout failed: ${message}`
    } else {
      error.value = `Could not checkout "${itemName}". Please try again.`
    }
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

  // Apply optimistic update: mark available immediately
  const idx = items.value.findIndex((i) => i.itemName === itemName)
  if (idx !== -1) {
    const item = items.value[idx]
    if (item) {
      optimisticSnapshots[itemName] = {
        available: item.available,
        lastKerb: item.lastKerb,
        lastCheckout: item.lastCheckout,
      }
      item.available = true
    }
  }

  try {
    // Send checkin data with json=true so apiFetch stringifies and parses
    await apiFetch<unknown>('/Reservation/checkinItem', {
      method: 'POST',
      json: true,
      body: { itemName },
    })

    actionSuccess.value = `Successfully checked in "${itemName}"`

    // Successful response: clear optimistic snapshot for this item
    if (optimisticSnapshots[itemName]) delete optimisticSnapshots[itemName]

    // Notify other views to refresh (include itemName so they can highlight)
    // The event watcher will handle refreshing this table too
    inventoryEvents.bump('checkin', itemName)

    // Clear success message after 3 seconds
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3000)
  } catch (err) {
    console.error('Checkin error:', err)
    const message = err instanceof Error ? err.message : ''

    // Revert optimistic update on error
    const idx = items.value.findIndex((i) => i.itemName === itemName)
    const snap = optimisticSnapshots[itemName]
    if (idx !== -1 && snap) {
      const current = items.value[idx]
      if (current) {
        current.available = snap.available
        current.lastKerb = snap.lastKerb
        current.lastCheckout = snap.lastCheckout
      }
      delete optimisticSnapshots[itemName]
    }

    // Friendly checkin error messages
    if (message.includes('not found') || message.includes('does not exist')) {
      error.value = `Item "${itemName}" not found. It may have been removed.`
    } else if (message.includes('already available') || message.includes('not checked out')) {
      error.value = `"${itemName}" is already available. No checkin needed.`
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      error.value = 'Your session expired. Please log in again.'
    } else if (message.includes('403') || message.includes('permission')) {
      error.value = "You don't have permission to checkin items."
    } else if (message) {
      error.value = `Checkin failed: ${message}`
    } else {
      error.value = `Could not checkin "${itemName}". Please try again.`
    }
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
  color: var(--bb-heading);
  margin-bottom: 30px;
}

.search-controls {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 20px;
  background-color: var(--bb-surface);
  border: 1px solid var(--bb-border);
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
  color: var(--bb-text);
  font-size: 14px;
}

select,
input[type='text'] {
  padding: 8px 12px;
  border: 1px solid var(--bb-border);
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

select:focus,
input[type='text']:focus {
  outline: none;
  border-color: var(--bb-primary);
  box-shadow: 0 0 0 2px rgba(55, 93, 96, 0.15);
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
  background-color: var(--bb-primary);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn-primary:disabled {
  background-color: rgba(55, 93, 96, 0.35);
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--bb-brown);
  color: #fff;
}

.btn-secondary:hover {
  filter: brightness(0.95);
}

.error-message {
  padding: 12px;
  background-color: rgba(218, 138, 113, 0.15);
  border: 1px solid rgba(218, 138, 113, 0.35);
  border-radius: 4px;
  color: var(--bb-brown);
  margin-bottom: 20px;
}

.success-message {
  padding: 12px;
  background-color: rgba(111, 217, 155, 0.15);
  border: 1px solid rgba(111, 217, 155, 0.35);
  border-radius: 4px;
  color: var(--bb-primary);
  margin-bottom: 20px;
  font-weight: 600;
}

.results-info {
  padding: 10px;
  background-color: rgba(111, 217, 155, 0.15);
  border: 1px solid rgba(111, 217, 155, 0.35);
  border-radius: 4px;
  color: var(--bb-primary);
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
  color: var(--bb-text);
  border-collapse: collapse;
  background-color: var(--bb-bg);
}

th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--bb-border);
}

th {
  background-color: var(--bb-primary);
  color: #fff;
  font-weight: 600;
  position: sticky;
  top: 0;
}

tr:hover {
  background-color: rgba(112, 206, 218, 0.08);
}

tr.unavailable {
  background-color: rgba(218, 138, 113, 0.08);
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
  color: var(--bb-primary);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.available {
  background-color: rgba(111, 217, 155, 0.2);
  color: var(--bb-primary);
}

.status-badge.unavailable {
  background-color: rgba(218, 138, 113, 0.2);
  color: var(--bb-brown);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  display: inline-block;
  padding: 3px 8px;
  background-color: rgba(55, 93, 96, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: var(--bb-primary);
}

.tag.category {
  background-color: rgba(112, 206, 218, 0.2);
  color: var(--bb-primary);
}

.action-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.kerb-input {
  padding: 6px 8px;
  border: 1px solid var(--bb-border);
  border-radius: 4px;
  font-size: 13px;
  min-width: 120px;
}

.kerb-input:disabled {
  background-color: #eef3f4;
  cursor: not-allowed;
}

.btn-action {
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
}

.btn-checkout {
  background-color: var(--bb-primary);
  color: #fff;
}

.btn-checkout:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn-checkout:disabled {
  background-color: rgba(55, 93, 96, 0.35);
  cursor: not-allowed;
}

.btn-checkin {
  background-color: var(--bb-mint);
  color: #0f3c34;
}

.btn-checkin:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn-checkin:disabled {
  background-color: rgba(111, 217, 155, 0.35);
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--bb-brown);
}

.empty-state p {
  font-size: 16px;
}
</style>
