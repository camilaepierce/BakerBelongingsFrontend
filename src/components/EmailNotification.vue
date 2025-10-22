<template>
  <div v-if="hasResults" class="email-notification-section">
    <h2>Send Notification</h2>
    <p class="notification-description">
      Send a message to all users with items in the current search results
    </p>

    <div class="notification-form">
      <label for="email-message">
        <span class="label-text">Message:</span>
        <textarea
          id="email-message"
          v-model="emailMessage"
          placeholder="Enter your notification message..."
          rows="4"
          class="message-input"
          :disabled="sendingEmail"
        ></textarea>
      </label>

      <button
        @click="handleSendEmail"
        :disabled="!emailMessage.trim() || sendingEmail"
        class="btn-send-email"
      >
        {{ sendingEmail ? 'Sending...' : 'Send Email' }}
      </button>
    </div>

    <!-- Email Success Message -->
    <div v-if="emailSuccess" class="email-success-message">
      {{ emailSuccess }}
    </div>

    <!-- Email Error Message -->
    <div v-if="emailError" class="email-error-message">
      {{ emailError }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { apiFetch } from '../lib/api'

const props = defineProps<{
  hasResults: boolean
}>()

const emailMessage = ref('')
const sendingEmail = ref(false)
const emailSuccess = ref('')
const emailError = ref('')

// Clear messages when hasResults changes
watch(
  () => props.hasResults,
  () => {
    emailSuccess.value = ''
    emailError.value = ''
  },
)

async function handleSendEmail() {
  if (!emailMessage.value.trim()) return

  sendingEmail.value = true
  emailError.value = ''
  emailSuccess.value = ''

  try {
    const response = await apiFetch<string[]>('/Reservation/notifyCheckout', {
      method: 'POST',
      json: true,
      body: { message: emailMessage.value.trim() },
    })

    const notifiedUsers = Array.isArray(response) ? response : []
    const count = notifiedUsers.length

    if (count > 0) {
      emailSuccess.value = `Successfully sent notifications to ${count} user${count !== 1 ? 's' : ''}: ${notifiedUsers.join(', ')}`
    } else {
      emailSuccess.value = 'No users to notify in the current results.'
    }

    emailMessage.value = ''

    // Clear success message after 5 seconds
    setTimeout(() => {
      emailSuccess.value = ''
    }, 5000)
  } catch (err) {
    console.error('Email notification error:', err)
    emailError.value =
      err instanceof Error ? err.message : 'Failed to send notifications. Please try again.'
  } finally {
    sendingEmail.value = false
  }
}
</script>

<style scoped>
.email-notification-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 30px;
  border: 1px solid #dee2e6;
}

.email-notification-section h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 8px;
  margin-top: 0;
}

.notification-description {
  color: #6c757d;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.notification-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notification-form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-text {
  font-weight: 600;
  color: #1a1d20;
  font-size: 14px;
}

.message-input {
  padding: 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
}

.message-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.1);
}

.message-input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.btn-send-email {
  padding: 12px 24px;
  background-color: #0d6efd;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.btn-send-email:hover:not(:disabled) {
  background-color: #0b5ed7;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-send-email:disabled {
  background-color: #87a8ee;
  cursor: not-allowed;
  transform: none;
}

.email-success-message {
  padding: 12px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
  margin-top: 16px;
  font-weight: 600;
}

.email-error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .email-notification-section {
    padding: 16px;
  }

  .btn-send-email {
    width: 100%;
  }
}
</style>
