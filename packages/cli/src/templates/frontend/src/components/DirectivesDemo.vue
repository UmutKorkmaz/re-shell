<template>
  <div class="directives-demo">
    <h2>Custom Directives Demo</h2>
    <p class="intro">
      This page demonstrates the custom directives included in the Vue CLI template.
      Each directive is designed to solve common UI/UX problems with minimal code.
    </p>

    <!-- v-click-outside Demo -->
    <section class="directive-section">
      <h3>v-click-outside</h3>
      <p>Click outside this dropdown to close it:</p>
      <div
        class="dropdown"
        v-click-outside="handleDropdownClose"
        ref="dropdown"
      >
        <button class="dropdown-toggle" @click="dropdownOpen = !dropdownOpen">
          {{ dropdownOpen ? '▼ Close' : '▶ Open' }}
        </button>
        <div v-show="dropdownOpen" class="dropdown-menu">
          <div class="dropdown-item">Option 1</div>
          <div class="dropdown-item">Option 2</div>
          <div class="dropdown-item">Option 3</div>
        </div>
      </div>
      <p class="status">Dropdown is {{ dropdownOpen ? 'open' : 'closed' }}</p>
    </section>

    <!-- v-tooltip Demo -->
    <section class="directive-section">
      <h3>v-tooltip</h3>
      <p>Hover over these buttons to see tooltips:</p>
      <div class="tooltip-demo">
        <button v-tooltip="'Default tooltip (bottom)'">Default Tooltip</button>
        <button v-tooltip.top="'Tooltip on top'">Top Tooltip</button>
        <button v-tooltip.left="'Tooltip on left'">Left Tooltip</button>
        <button v-tooltip.right="'Tooltip on right'">Right Tooltip</button>
      </div>
    </section>

    <!-- v-loading Demo -->
    <section class="directive-section">
      <h3>v-loading</h3>
      <p>Toggle loading state on the card below:</p>
      <div class="loading-demo">
        <button @click="toggleLoading" class="toggle-btn">
          {{ isLoading ? 'Stop Loading' : 'Start Loading' }}
        </button>
        <div class="card" v-loading="isLoading ? 'Loading data...' : false">
          <h4>Card with Loading Overlay</h4>
          <p>This card shows a loading overlay when enabled.</p>
          <p>The loading state can be customized with a message.</p>
        </div>
      </div>
    </section>

    <!-- v-lazy Demo -->
    <section class="directive-section">
      <h3>v-lazy</h3>
      <p>Scroll down to see lazy loaded images:</p>
      <div class="lazy-demo">
        <div v-for="n in 6" :key="n" class="image-container">
          <img
            v-lazy="`https://picsum.photos/seed/lazy${n}/300/200.jpg`"
            alt="Lazy loaded image"
            class="lazy-image"
          >
          <p class="image-caption">Image {{ n }} (Lazy Loaded)</p>
        </div>
      </div>
      <p class="scroll-note">Scroll up and down to see the lazy loading in action!</p>
    </section>

    <!-- v-autofocus Demo -->
    <section class="directive-section">
      <h3>v-autofocus</h3>
      <p>Try opening this modal - the input will be focused automatically:</p>
      <button @click="showAutofocusModal" class="demo-btn">Show Autofocus Demo</button>
    </section>

    <!-- v-debounce Demo -->
    <section class="directive-section">
      <h3>v-debounce</h3>
      <p>Type in the input below - the search will be debounced:</p>
      <div class="debounce-demo">
        <input
          v-debounce="handleDebouncedSearch"
          type="text"
          placeholder="Type something (debounced)"
          class="debounce-input"
        >
        <p class="debounce-info">Last search: {{ lastSearch }}</p>
        <p class="debounce-note">
          Notice how the search only triggers after you stop typing for 500ms.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useToast } from '@/plugins'

const toast = useToast()

// Dropdown state
const dropdownOpen = ref(false)
const dropdown = ref(null)

const handleDropdownClose = () => {
  dropdownOpen.value = false
  toast.show('Dropdown closed!', { type: 'info' })
}

// Loading state
const isLoading = ref(false)

const toggleLoading = () => {
  isLoading.value = !isLoading.value
  if (isLoading.value) {
    toast.success('Loading state activated', { duration: 2000 })
  } else {
    toast.info('Loading state deactivated', { duration: 2000 })
  }
}

// Debounce search
const lastSearch = ref('')

const handleDebouncedSearch = (event) => {
  lastSearch.value = event.target.value
  toast.show(`Searching for: "${lastSearch.value}"`, { duration: 1500 })
}

// Autofocus modal
const showAutofocusModal = () => {
  const modalContent = `
    <div>
      <h4>Autofocus Demo</h4>
      <p>This modal has an automatically focused input field:</p>
      <input type="text" v-autofocus.select placeholder="I'm already focused and selected!" class="modal-input">
      <p class="note">Try closing and reopening to see the autofocus behavior.</p>
    </div>
  `

  // Create modal with autofocus
  const closeModal = document.createElement('div')
  document.body.appendChild(closeModal)

  // Create modal element
  const modal = document.createElement('div')
  modal.className = 'modal-autofocus-demo'
  modal.innerHTML = modalContent

  // Add styles
  const style = document.createElement('style')
  style.textContent = `
    .modal-autofocus-demo {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 10000;
    }

    .modal-autofocus-demo .modal-input {
      width: 100%;
      padding: 10px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .modal-autofocus-demo .note {
      color: #666;
      font-size: 14px;
      margin-top: 10px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    }
  `
  document.head.appendChild(style)

  // Create overlay
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  // Add click handler for overlay
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay)
    document.body.removeChild(modal)
    document.head.removeChild(style)
  })

  // Add close button
  const closeBtn = document.createElement('button')
  closeBtn.textContent = 'Close'
  closeBtn.className = 'close-btn'
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 8px 16px;
    background: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(overlay)
    document.body.removeChild(modal)
    document.head.removeChild(style)
  })

  modal.appendChild(closeBtn)
  document.body.appendChild(overlay)
  document.body.appendChild(modal)

  // Focus input after modal is added to DOM
  nextTick(() => {
    const input = modal.querySelector('input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}
</script>

<style scoped>
.directives-demo {
  max-width: 800px;
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

.directive-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.directive-section h3 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
}

/* Dropdown styles */
.dropdown {
  position: relative;
  display: inline-block;
  margin: 1rem 0;
}

.dropdown-toggle {
  padding: 0.5rem 1rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  min-width: 150px;
  z-index: 100;
}

.dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #f0f0f0;
}

.status {
  margin-top: 0.5rem;
  font-size: 14px;
  color: #666;
}

/* Tooltip demo */
.tooltip-demo {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.tooltip-demo button {
  padding: 0.5rem 1rem;
  background: #2196f3;
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

.toggle-btn {
  padding: 0.5rem 1rem;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.card {
  padding: 1.5rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* Lazy demo */
.lazy-demo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
}

.image-container {
  text-align: center;
}

.lazy-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.image-caption {
  margin-top: 0.5rem;
  color: #666;
}

.scroll-note {
  text-align: center;
  color: #666;
  font-style: italic;
}

/* Debounce demo */
.debounce-demo {
  margin: 1rem 0;
}

.debounce-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.debounce-info {
  margin-top: 1rem;
  color: #2196f3;
}

.debounce-note {
  margin-top: 0.5rem;
  color: #666;
  font-size: 14px;
}

/* Demo buttons */
.demo-btn {
  padding: 0.75rem 1.5rem;
  background: #9c27b0;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

@media (max-width: 600px) {
  .directives-demo {
    padding: 1rem;
  }

  .tooltip-demo {
    flex-direction: column;
  }

  .lazy-demo {
    grid-template-columns: 1fr;
  }
}
</style>