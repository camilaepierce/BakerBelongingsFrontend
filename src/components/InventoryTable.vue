<template>
  <div class="inventory-viewer">
    <h1 v-if="!hideTitle">Inventory Viewer</h1>

    <!-- Search Controls -->
    <div class="search-controls" v-if="!hideSearchControls">
      <div class="search-section">
        <label>
          <span>Search Type:</span>
          <select v-model="searchType">
            <option value="available">View Available</option>
            <option value="checked-out">View Checked Out</option>
            <option value="item">Search by Item Name</option>
            <option value="category">Search by Category</option>
            <option value="tag">Search by Tag</option>
            <option value="adjacent">AI: Similar Items</option>
            <!-- Removed AI: Autocomplete option -->
            <option value="recommend">AI: Recommendations</option>
          </select>
        </label>
      </div>

      <div
        class="search-section"
        v-if="
          searchType !== 'available' && searchType !== 'checked-out' && searchType !== 'recommend'
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
    | 'item'
    | 'category'
    | 'tag'
    | 'adjacent'
    | 'autocomplete'
    | 'recommend'
  externalSearchQuery?: string
  triggerSearch?: number
}>()

const searchType = ref<
  | 'available'
  | 'checked-out'
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
        // New backend behavior: prefer empty results over throwing
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
          // console.log(result)
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

    if (!error.value && result.length === 0) {
      // If no results, try AI autocomplete
      if (searchType.value === 'item' && searchQuery.value.trim()) {
        try {
          const autoData = await apiFetch<unknown>('/Viewer/viewAutocomplete', {
            method: 'POST',
            json: true,
            body: { prefix: searchQuery.value.trim() },
          })
          const autoResults = parseItemsFromData(autoData)
          if (autoResults.length > 0) {
            items.value = autoResults
            error.value = 'No exact matches found. Showing AI autocomplete suggestions below.'
          } else {
            error.value = 'No items matched your search. Try refining your query or check spelling.'
          }
        } catch {
          error.value = 'No items matched your search. Try refining your query or check spelling.'
        }
      } else {
        error.value = 'No items matched your search. Try refining your query or check spelling.'
      }
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
  } finally {
    loading.value = false
  }
}

function clearResults() {
  items.value = []
  searchQuery.value = ''
  error.value = ''
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
  max-width: 1200px;
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

/* Subtle highlight when a row was just updated elsewhere */
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

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--bb-brown);
}

.empty-state p {
  font-size: 16px;
}
</style>
