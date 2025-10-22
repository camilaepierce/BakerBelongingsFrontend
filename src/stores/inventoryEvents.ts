import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useInventoryEventsStore = defineStore('inventoryEvents', () => {
  // Monotonic version that increments whenever an inventory-affecting action happens
  const version = ref(0)
  const lastReason = ref<string | undefined>(undefined)
  const lastAt = ref<Date | undefined>(undefined)
  const lastItemName = ref<string | undefined>(undefined)

  function bump(reason?: string, itemName?: string) {
    version.value++
    lastReason.value = reason
    lastAt.value = new Date()
    lastItemName.value = itemName
  }

  return { version, lastReason, lastAt, lastItemName, bump }
})
