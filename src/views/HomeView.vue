<script setup lang="ts">
import { ref, onMounted } from 'vue'
import InventoryTable from '../components/InventoryTable.vue'

// Trigger an initial search when the page loads so users immediately see inventory
const trigger = ref<number>(0)
onMounted(() => {
  trigger.value = Date.now()
})
</script>

<template>
  <main>
    <InventoryTable
      :hide-title="false"
      :external-search-type="'available'"
      :trigger-search="trigger"
    />
  </main>
</template>
