<template>
  <div class="about">
    <div class="about-header">
      <h1>Baker Belongings Inventory</h1>
      <p class="subtitle">Search and explore our inventory</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <ReloadInventoryButton @reloaded="triggerSearch" />
    </div>

    <!-- Custom Search Bar Component -->
    <SearchBar
      v-model:searchType="searchType"
      v-model:searchQuery="searchQuery"
      @search="triggerSearch"
    />

    <!-- Inventory Table (with search controls hidden) -->
    <InventoryTable
      :hideTitle="true"
      :hideSearchControls="true"
      :externalSearchType="searchType"
      :externalSearchQuery="searchQuery"
      :triggerSearch="searchTrigger"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import InventoryTable from '../components/InventoryTable.vue'
import SearchBar from '../components/SearchBar.vue'
import ReloadInventoryButton from '../components/ReloadInventoryButton.vue'

const searchType = ref<'available' | 'item' | 'category' | 'tag'>('available')
const searchQuery = ref('')
const searchTrigger = ref(0)

function triggerSearch() {
  searchTrigger.value++
}
</script>

<style scoped>
.about {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 20px;
}

.about-header {
  text-align: center;
  margin-bottom: 40px;
}

.about-header h1 {
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
}

@media (max-width: 768px) {
  .about-header h1 {
    font-size: 2rem;
  }
}

@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
  }
}
</style>
