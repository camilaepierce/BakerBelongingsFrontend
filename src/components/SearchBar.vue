<template>
  <div class="custom-search-bar">
    <div class="search-input-group">
      <label for="search-type">Search by:</label>
      <select id="search-type" v-model="localSearchType" class="search-select">
        <option value="available">All Available Items</option>
        <option value="item">Item Name</option>
        <option value="category">Category</option>
        <option value="tag">Tag</option>
      </select>
    </div>

    <div class="search-input-group" v-if="localSearchType !== 'available'">
      <label for="search-query">Search term:</label>
      <input
        id="search-query"
        v-model="localSearchQuery"
        type="text"
        :placeholder="getPlaceholder()"
        class="search-input"
        @keyup.enter="handleSearch"
      />
    </div>

    <button @click="handleSearch" class="search-button">
      <span class="search-icon">🔍</span>
      Search
    </button>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps<{
  searchType?: 'available' | 'item' | 'category' | 'tag'
  searchQuery?: string
}>()

const emit = defineEmits<{
  'update:searchType': [value: 'available' | 'item' | 'category' | 'tag']
  'update:searchQuery': [value: string]
  search: []
}>()

const localSearchType = ref<'available' | 'item' | 'category' | 'tag'>(
  props.searchType || 'available',
)
const localSearchQuery = ref(props.searchQuery || '')

watch(
  () => props.searchType,
  (newType) => {
    if (newType) {
      localSearchType.value = newType
    }
  },
)

watch(
  () => props.searchQuery,
  (newQuery) => {
    if (newQuery !== undefined) {
      localSearchQuery.value = newQuery
    }
  },
)

watch(localSearchType, (newType) => {
  emit('update:searchType', newType)
})

watch(localSearchQuery, (newQuery) => {
  emit('update:searchQuery', newQuery)
})

function handleSearch() {
  emit('search')
}

function getPlaceholder(): string {
  switch (localSearchType.value) {
    case 'item':
      return 'Enter item name...'
    case 'category':
      return 'Enter category...'
    case 'tag':
      return 'Enter tag...'
    default:
      return ''
  }
}
</script>

<style scoped>
.custom-search-bar {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.search-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.search-input-group label {
  color: white;
  font-weight: 600;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.search-select,
.search-input {
  padding: 12px 16px;
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 15px;
  background-color: white;
  transition: all 0.3s ease;
}

.search-select:focus,
.search-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.2);
}

.search-button {
  padding: 12px 30px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.search-button:hover {
  background-color: #359268;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.search-button:active {
  transform: translateY(0);
}

.search-icon {
  font-size: 18px;
}

@media (max-width: 768px) {
  .custom-search-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input-group {
    width: 100%;
  }

  .search-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
