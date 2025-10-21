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
            <option value="item">Search by Item Name</option>
            <option value="category">Search by Category</option>
            <option value="tag">Search by Tag</option>
          </select>
        </label>
      </div>

      <div class="search-section" v-if="searchType !== 'available'">
        <label>
          <span
            >{{
              searchType === 'item' ? 'Item Name' : searchType === 'category' ? 'Category' : 'Tag'
            }}:</span
          >
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="`Enter ${searchType}...`"
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
          <tr v-for="(item, index) in items" :key="index" :class="{ unavailable: !item.available }">
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
import { ref, watch } from 'vue'
import { apiFetch } from '../lib/api'

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
  externalSearchType?: 'available' | 'item' | 'category' | 'tag'
  externalSearchQuery?: string
  triggerSearch?: number
}>()

const searchType = ref<'available' | 'item' | 'category' | 'tag'>(
  props.externalSearchType || 'available',
)
const searchQuery = ref(props.externalSearchQuery || '')
const items = ref<InventoryItem[]>([])
const loading = ref(false)
const error = ref('')

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

  console.log('Starting search with type:', searchType.value, 'query:', searchQuery.value)

  try {
    let result: InventoryItem[]

    switch (searchType.value) {
      case 'available':
        console.log('Fetching available items')
        {
          const resp = (await apiFetch<Response>('/Viewer/viewAvailable', {
            method: 'POST',
            json: false,
            headers: { 'Content-Type': 'text/plain' },
            body: '',
          })) as unknown as Response
          result = (await resp.json()) as InventoryItem[]
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
          const resp = (await apiFetch<Response>('/Viewer/viewItem', {
            method: 'POST',
            json: false,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchQuery.value.trim()),
          })) as unknown as Response
          result = (await resp.json()) as InventoryItem[]
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
          const resp = (await apiFetch<Response>('/Viewer/viewCategory', {
            method: 'POST',
            json: false,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchQuery.value.trim()),
          })) as unknown as Response
          result = (await resp.json()) as InventoryItem[]
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
          const resp = (await apiFetch<Response>('/Viewer/viewTag', {
            method: 'POST',
            json: false,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchQuery.value.trim()),
          })) as unknown as Response
          result = (await resp.json()) as InventoryItem[]
        }
        break

      default:
        result = []
    }

    console.log('Search result:', result)
    items.value = result

    if (result.length === 0) {
      error.value = 'No items found'
    }
  } catch (err) {
    console.error('Search error:', err)
    error.value = err instanceof Error ? err.message : 'An error occurred while fetching data'
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
</script>

<style scoped>
.inventory-viewer {
  max-width: 1200px;
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
  color: #495057;
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

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-state p {
  font-size: 16px;
}
</style>
