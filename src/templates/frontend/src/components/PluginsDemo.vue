<template>
  <div class="plugins-demo">
    <h2>Custom Plugins Demo</h2>
    <p class="intro">
      This page demonstrates the custom plugins included in the Vue CLI template.
      Each plugin provides powerful functionality with minimal setup required.
    </p>

    <!-- Toast Plugin Demo -->
    <section class="plugin-section">
      <h3>Toast Notifications</h3>
      <p>Show different types of toast notifications:</p>
      <div class="toast-controls">
        <button @click="showSuccessToast" class="toast-btn success">Success</button>
        <button @click="showErrorToast" class="toast-btn error">Error</button>
        <button @click="showWarningToast" class="toast-btn warning">Warning</button>
        <button @click="showInfoToast" class="toast-btn info">Info</button>
        <button @click="showCustomToast" class="toast-btn primary">Custom</button>
      </div>
      <p class="toast-note">
        Toasts appear in the top-right corner with auto-dismiss after 3 seconds.
      </p>
    </section>

    <!-- Modal Plugin Demo -->
    <section class="plugin-section">
      <h3>Modal Dialogs</h3>
      <p>Test different modal types:</p>
      <div class="modal-controls">
        <button @click="showBasicModal" class="modal-btn primary">Basic Modal</button>
        <button @click="showAlertModal" class="modal-btn warning">Alert</button>
        <button @click="showConfirmModal" class="modal-btn danger">Confirm</button>
        <button @click="showLargeModal" class="modal-btn secondary">Large Modal</button>
      </div>
    </section>

    <!-- Event Bus Demo -->
    <section class="plugin-section">
      <h3>Event Bus</h3>
      <p>Demonstrates component communication through event bus:</p>
      <div class="event-demo">
        <div class="event-panel">
          <h4>Event Publisher</h4>
          <button @click="emitEvent" class="emit-btn">Emit Custom Event</button>
          <button @click="emitWithPayload" class="emit-btn payload-btn">Emit with Data</button>
        </div>
        <div class="event-panel">
          <h4>Event Listener</h4>
          <div class="event-log">
            <div v-for="(event, index) in eventLog" :key="index" class="event-item">
              {{ event }}
            </div>
          </div>
          <button @click="clearEventLog" class="clear-btn">Clear Log</button>
        </div>
      </div>
    </section>

    <!-- Loading Plugin Demo -->
    <section class="plugin-section">
      <h3>Loading State</h3>
      <p>Demonstrates global loading state management:</p>
      <div class="loading-demo">
        <button @click="runAsyncTask" class="loading-btn">Run Async Task</button>
        <button @click="runMultipleTasks" class="loading-btn multiple">Run Multiple Tasks</button>
        <div class="loading-status">
          <p>Current loading state: {{ isLoading ? 'Active' : 'Idle' }}</p>
          <p>Active loading operations: {{ loadingCount }}</p>
        </div>
      </div>
    </section>

    <!-- Storage Plugin Demo -->
    <section class="plugin-section">
      <h3>Storage Management</h3>
      <p>Demonstrates localStorage integration:</p>
      <div class="storage-demo">
        <div class="storage-panel">
          <h4>localStorage</h4>
          <input v-model="storageInput" placeholder="Enter text to save" class="storage-input" />
          <button @click="saveToLocalStorage" class="storage-btn save">Save</button>
          <button @click="loadFromLocalStorage" class="storage-btn load">Load</button>
          <button @click="clearLocalStorage" class="storage-btn clear">Clear</button>
          <p v-if="localStorageData" class="storage-data">
            Saved data: {{ localStorageData }}
          </p>
        </div>
        <div class="storage-panel">
          <h4>sessionStorage</h4>
          <p>Try refreshing the page - sessionStorage data will be cleared.</p>
          <input v-model="sessionInput" placeholder="Enter text to save" class="storage-input" />
          <button @click="saveToSessionStorage" class="storage-btn session-save">Save</button>
          <button @click="loadFromSessionStorage" class="storage-btn session-load">Load</button>
          <button @click="clearSessionStorage" class="storage-btn session-clear">Clear</button>
          <p v-if="sessionData" class="storage-data">
            Saved data: {{ sessionData }}
          </p>
        </div>
      </div>
    </section>

    <!-- Combined Features Demo -->
    <section class="plugin-section">
      <h3>Combined Features Demo</h3>
      <p>This demo shows multiple plugins working together:</p>
      <div class="combined-demo">
        <button @click="runCombinedDemo" class="combined-btn">
          Run Combined Demo
        </button>
        <div v-if="combinedProgress" class="combined-progress">
          <p>Progress: {{ combinedProgress }}%</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: combinedProgress + '%' }"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { inject } from 'vue'

// Inject plugins
const toast = inject('toast')
const modal = inject('modal')
const eventBus = inject('eventBus')
const storage = inject('storage')

// Toast demo
const showSuccessToast = () => {
  toast.success('Operation completed successfully!')
}

const showErrorToast = () => {
  toast.error('Something went wrong!', {
    duration: 5000,
    action: {
      text: 'Retry',
      handler: () => {
        toast.info('Retrying operation...')
      }
    }
  })
}

const showWarningToast = () => {
  toast.warning('Please check your input and try again.')
}

const showInfoToast = () => {
  toast.info('This is an informational message.')
}

const showCustomToast = () => {
  toast.show('Custom toast with custom duration', {
    duration: 2000,
    type: 'info'
  })
}

// Modal demo
const showBasicModal = () => {
  modal.show({
    title: 'Basic Modal',
    content: '<p>This is a basic modal with custom content.</p><p>You can put any HTML here!</p>',
    buttons: [
      {
        text: 'Close',
        type: 'secondary'
      },
      {
        text: 'Save',
        type: 'primary'
      }
    ]
  })
}

const showAlertModal = () => {
  modal.alert('This is an alert!', 'Alert Demo')
    .then(() => {
      toast.success('Alert acknowledged!')
    })
}

const showConfirmModal = async () => {
  const confirmed = await modal.confirm('Are you sure you want to continue?', 'Confirm Action')
  if (confirmed) {
    toast.success('Action confirmed!')
  } else {
    toast.info('Action cancelled')
  }
}

const showLargeModal = () => {
  modal.show({
    title: 'Large Modal Demo',
    content: `
      <div style="padding: 20px;">
        <h4>Large Content Area</h4>
        <p>This modal demonstrates a larger content area.</p>
        <p>You can put forms, tables, or any complex UI here.</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <button onclick="this.closest('.modal-container').remove()" style="
          margin-top: 20px;
          padding: 8px 16px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Close Inside</button>
      </div>
    `,
    size: 'large',
    showFooter: false
  })
}

// Event bus demo
const eventLog = ref([])

const emitEvent = () => {
  eventBus.emit('custom-event', { message: 'Hello from Event Bus!' })
  addEventLog('Custom event emitted')
}

const emitWithPayload = () => {
  const payload = {
    type: 'user-action',
    data: { timestamp: new Date().toISOString() },
    id: Math.random().toString(36).substr(2, 9)
  }
  eventBus.emit('payload-event', payload)
  addEventLog(`Event with payload: ${JSON.stringify(payload)}`)
}

const addEventLog = (message) => {
  eventLog.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
  if (eventLog.value.length > 10) {
    eventLog.value.pop()
  }
}

// Listen for events
eventBus.on('custom-event', (data) => {
  toast.show(`Received: ${data.message}`, { duration: 2000 })
  addEventLog(`Event received: ${data.message}`)
})

eventBus.on('payload-event', (payload) => {
  toast.show(`Complex payload received!`, { type: 'success', duration: 2000 })
})

const clearEventLog = () => {
  eventLog.value = []
}

// Loading demo
const loading = inject('loading')
const loadingCount = ref(0)
const isLoading = ref(false)

const runAsyncTask = async () => {
  await loading.withLoading(async () => {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 2000))
    toast.success('Async task completed!')
  }, 'Processing...')
}

const runMultipleTasks = async () => {
  loadingCount.value = 0
  isLoading.value = true

  // Run multiple async tasks
  const tasks = [
    loadingTask('Task 1', 1000),
    loadingTask('Task 2', 1500),
    loadingTask('Task 3', 800),
    loadingTask('Task 4', 1200)
  ]

  await Promise.all(tasks)
  toast.success('All tasks completed!')
  isLoading.value = false
}

const loadingTask = async (name, duration) => {
  loading.show(`${name} started...`)
  loadingCount.value++

  await new Promise(resolve => setTimeout(resolve, duration))

  loading.hide()
  loadingCount.value--
  console.log(`${name} completed`)
}

// Storage demo
const storageInput = ref('')
const localStorageData = ref('')
const sessionInput = ref('')
const sessionData = ref('')

const saveToLocalStorage = () => {
  if (storageInput.value.trim()) {
    storage.localStorage.set('demo-data', storageInput.value)
    localStorageData.value = storageInput.value
    toast.success('Data saved to localStorage!')
  }
}

const loadFromLocalStorage = () => {
  const data = storage.localStorage.get('demo-data')
  if (data) {
    localStorageData.value = data
    toast.success('Data loaded from localStorage!')
  } else {
    toast.warning('No data found in localStorage')
  }
}

const clearLocalStorage = () => {
  storage.localStorage.remove('demo-data')
  localStorageData.value = ''
  storageInput.value = ''
  toast.info('localStorage cleared!')
}

const saveToSessionStorage = () => {
  if (sessionInput.value.trim()) {
    storage.sessionStorage.set('session-demo', sessionInput.value)
    sessionData.value = sessionInput.value
    toast.success('Data saved to sessionStorage!')
  }
}

const loadFromSessionStorage = () => {
  const data = storage.sessionStorage.get('session-demo')
  if (data) {
    sessionData.value = data
    toast.success('Data loaded from sessionStorage!')
  } else {
    toast.warning('No data found in sessionStorage')
  }
}

const clearSessionStorage = () => {
  storage.sessionStorage.remove('session-demo')
  sessionData.value = ''
  sessionInput.value = ''
  toast.info('sessionStorage cleared!')
}

// Combined demo
const combinedProgress = ref(0)

const runCombinedDemo = async () => {
  // Show loading
  loading.show('Running combined demo...')

  // Show starting message
  toast.info('Starting combined demo...')

  // Simulate progress
  let progress = 0
  const interval = setInterval(() => {
    progress += 10
    combinedProgress.value = progress

    if (progress === 50) {
      toast.show('Halfway there!', { type: 'success' })
    }

    if (progress >= 100) {
      clearInterval(interval)
      hideLoading()
      toast.success('Combined demo completed!')

      // Emit event
      eventBus.emit('demo-completed', {
        steps: 10,
        duration: '2 seconds'
      })
    }
  }, 200)

  // Hide loading after demo
  setTimeout(() => {
    hideLoading()
  }, 2000)
}

const hideLoading = () => {
  loading.hide()
  setTimeout(() => {
    combinedProgress.value = 0
  }, 1000)
}
</script>

<style scoped>
.plugins-demo {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.intro {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border-left: 4px solid #2196f3;
}

.plugin-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.plugin-section h3 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
}

/* Toast controls */
.toast-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.toast-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s;
}

.toast-btn:hover {
  transform: translateY(-2px);
}

.toast-btn.success {
  background: #4caf50;
  color: white;
}

.toast-btn.error {
  background: #f44336;
  color: white;
}

.toast-btn.warning {
  background: #ff9800;
  color: white;
}

.toast-btn.info {
  background: #2196f3;
  color: white;
}

.toast-btn.primary {
  background: #9c27b0;
  color: white;
}

.toast-note {
  margin-top: 1rem;
  color: #666;
  font-size: 14px;
}

/* Modal controls */
.modal-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.modal-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s;
}

.modal-btn:hover {
  transform: translateY(-2px);
}

.modal-btn.primary {
  background: #2196f3;
  color: white;
}

.modal-btn.secondary {
  background: #607d8b;
  color: white;
}

.modal-btn.warning {
  background: #ff9800;
  color: white;
}

.modal-btn.danger {
  background: #f44336;
  color: white;
}

/* Event demo */
.event-demo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 1rem 0;
}

.event-panel {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.event-panel h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.emit-btn {
  padding: 0.5rem 1rem;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
}

.payload-btn {
  background: #9c27b0;
}

.event-log {
  max-height: 200px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.event-item {
  padding: 0.25rem 0;
  font-size: 14px;
  border-bottom: 1px solid #eee;
}

.event-item:last-child {
  border-bottom: none;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #607d8b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Loading demo */
.loading-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-btn {
  padding: 0.75rem 1.5rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.loading-btn:hover {
  transform: translateY(-2px);
}

.loading-btn.multiple {
  background: #ff9800;
}

.loading-status {
  padding: 1rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.loading-status p {
  margin: 0.5rem 0;
  color: #2c3e50;
}

/* Storage demo */
.storage-demo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 1rem 0;
}

.storage-panel {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.storage-panel h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.storage-input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.storage-btn {
  padding: 0.5rem 1rem;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.storage-btn.save {
  background: #2196f3;
  color: white;
}

.storage-btn.load {
  background: #4caf50;
  color: white;
}

.storage-btn.clear {
  background: #f44336;
  color: white;
}

.storage-btn.session-save {
  background: #9c27b0;
  color: white;
}

.storage-btn.session-load {
  background: #ff9800;
  color: white;
}

.storage-btn.session-clear {
  background: #607d8b;
  color: white;
}

.storage-data {
  margin-top: 1rem;
  padding: 0.5rem;
  background: #e8f5e9;
  border-radius: 4px;
  color: #2e7d32;
  font-size: 14px;
}

/* Combined demo */
.combined-demo {
  text-align: center;
}

.combined-btn {
  padding: 1rem 2rem;
  background: linear-gradient(45deg, #2196f3, #9c27b0);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: transform 0.2s;
}

.combined-btn:hover {
  transform: translateY(-2px);
}

.combined-progress {
  margin-top: 2rem;
}

.combined-progress p {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #4caf50);
  transition: width 0.3s ease;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .plugins-demo {
    padding: 1rem;
  }

  .event-demo,
  .storage-demo {
    grid-template-columns: 1fr;
  }

  .toast-controls,
  .modal-controls {
    flex-direction: column;
  }

  .toast-btn,
  .modal-btn {
    width: 100%;
  }
}
</style>