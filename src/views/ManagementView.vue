<template>
  <div class="management">
    <div class="management-header">
      <h1>Inventory Management</h1>
      <p class="subtitle">Checkout and checkin inventory items</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button v-if="hasResults" @click="toggleEmailNotification" class="btn-toggle-email">
        {{ showEmailNotification ? 'Hide Email Notification' : 'Show Email Notification' }}
      </button>
    </div>

    <!-- Custom Search Bar Component -->
    <SearchBar
      v-model:searchType="searchType"
      v-model:searchQuery="searchQuery"
      @search="triggerSearch"
    />

    <!-- Email Notification Section -->
    <EmailNotification v-if="showEmailNotification" :hasResults="hasResults" />

    <!-- Inventory Management Table (with search controls hidden) -->
    <InventoryManagementTable
      ref="managementTable"
      :hideTitle="true"
      :hideSearchControls="true"
      :externalSearchType="searchType"
      :externalSearchQuery="searchQuery"
      :triggerSearch="searchTrigger"
      @results-updated="handleResultsUpdated"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import InventoryManagementTable from '../components/InventoryManagementTable.vue'
import SearchBar from '../components/SearchBar.vue'
import EmailNotification from '../components/EmailNotification.vue'

const searchType = ref<'available' | 'checked-out' | 'expired' | 'item' | 'category' | 'tag'>(
  'available',
)
const searchQuery = ref('')
const searchTrigger = ref(0)
const hasResults = ref(false)
const showEmailNotification = ref(false)

function triggerSearch() {
  searchTrigger.value++
}

function handleResultsUpdated(itemCount: number) {
  hasResults.value = itemCount > 0
}

function toggleEmailNotification() {
  showEmailNotification.value = !showEmailNotification.value
}
</script>

<style scoped>
.management {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 20px;
}

.management-header {
  text-align: center;
  margin-bottom: 40px;
}

.management-header h1 {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 1.1rem;
  color: #6c757d;
  margin: 0;
}

.controls {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
}

.btn-toggle-email {
  padding: 10px 20px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-toggle-email:hover {
  background-color: #359268;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .management-header h1 {
    font-size: 2rem;
  }

  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-toggle-email {
    width: 100%;
  }
}

@media (min-width: 1024px) {
  .management {
    min-height: 100vh;
  }
}
</style>
