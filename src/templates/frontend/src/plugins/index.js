import { createApp, ref, onUnmounted } from 'vue'
import { nextTick } from 'vue'

/**
 * Vue 3 Custom Plugins
 *
 * This module provides a collection of useful custom plugins for Vue 3 applications.
 * Each plugin is designed to be reusable, configurable, and follows Vue 3 best practices.
 */

// Event Bus Plugin
// Provides centralized event system for component communication
export const createEventBus = () => {
  const events = {}

  const on = (event, callback) => {
    if (!events[event]) {
      events[event] = []
    }
    events[event].push(callback)
  }

  const off = (event, callback) => {
    if (!events[event]) return
    events[event] = events[event].filter(cb => cb !== callback)
  }

  const emit = (event, payload) => {
    if (!events[event]) return
    events[event].forEach(callback => {
      try {
        callback(payload)
      } catch (error) {
        console.error(`Event bus error for event "${event}":`, error)
      }
    })
  }

  const once = (event, callback) => {
    const onceCallback = (payload) => {
      callback(payload)
      off(event, onceCallback)
    }
    on(event, onceCallback)
  }

  // Clear all events
  const clear = () => {
    Object.keys(events).forEach(key => {
      delete events[key]
    })
  }

  return {
    on,
    off,
    emit,
    once,
    clear
  }
}

// Toast Notification Plugin
// Displays toast notifications with customizable options
export const createToastPlugin = () => {
  let toastContainer = null
  let toastCounter = 0

  const createToastContainer = () => {
    if (document.querySelector('.toast-container')) return

    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
      }

      .toast {
        background: white;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 10px;
        padding: 16px 20px;
        min-width: 300px;
        max-width: 500px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease-out;
        position: relative;
      }

      .toast.success {
        border-left: 4px solid #4caf50;
      }

      .toast.error {
        border-left: 4px solid #f44336;
      }

      .toast.warning {
        border-left: 4px solid #ff9800;
      }

      .toast.info {
        border-left: 4px solid #2196f3;
      }

      .toast-icon {
        font-size: 20px;
      }

      .toast.success .toast-icon {
        color: #4caf50;
      }

      .toast.error .toast-icon {
        color: #f44336;
      }

      .toast.warning .toast-icon {
        color: #ff9800;
      }

      .toast.info .toast-icon {
        color: #2196f3;
      }

      .toast-message {
        flex: 1;
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }

      .toast-close:hover {
        background: #f5f5f5;
      }

      .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: currentColor;
        animation: progress 3s linear forwards;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes progress {
        from {
          width: 100%;
        }
        to {
          width: 0;
        }
      }
    `
    document.head.appendChild(style)
  }

  const showToast = (message, options = {}) => {
    const {
      type = 'info',
      duration = 3000,
      closable = true,
      action,
      id = ++toastCounter
    } = options

    createToastContainer()

    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.dataset.id = id

    // Icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    }

    // Create toast content
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
      ${closable ? '<button class="toast-close">×</button>' : ''}
      ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
    `

    // Add action button if provided
    if (action) {
      const actionButton = document.createElement('button')
      actionButton.className = 'toast-action'
      actionButton.textContent = action.text
      actionButton.onclick = action.handler
      toast.appendChild(actionButton)
    }

    // Add close button handler
    const closeButton = toast.querySelector('.toast-close')
    if (closeButton) {
      closeButton.onclick = () => {
        removeToast(id)
      }
    }

    // Add to container
    const container = document.querySelector('.toast-container')
    container.appendChild(toast)

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  const removeToast = (id) => {
    const toast = document.querySelector(`.toast[data-id="${id}"]`)
    if (toast) {
      toast.style.animation = 'slideIn 0.3s ease-out reverse'
      setTimeout(() => {
        toast.remove()
        // Remove container if empty
        const container = document.querySelector('.toast-container')
        if (container && container.children.length === 0) {
          container.remove()
        }
      }, 300)
    }
  }

  const success = (message, options) => showToast(message, { ...options, type: 'success' })
  const error = (message, options) => showToast(message, { ...options, type: 'error' })
  const warning = (message, options) => showToast(message, { ...options, type: 'warning' })
  const info = (message, options) => showToast(message, { ...options, type: 'info' })

  return {
    show: showToast,
    success,
    error,
    warning,
    info,
    remove: removeToast
  }
}

// Modal Dialog Plugin
// Provides modal dialogs with customizable content and options
export const createModalPlugin = () => {
  let modalContainer = null

  const createModalContainer = () => {
    if (document.querySelector('.modal-container')) return

    modalContainer = document.createElement('div')
    modalContainer.className = 'modal-container'
    document.body.appendChild(modalContainer)

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .modal-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        animation: fadeIn 0.2s ease-out;
      }

      .modal {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        max-width: 90%;
        max-height: 90vh;
        overflow: auto;
        position: relative;
        z-index: 1;
        animation: slideUp 0.3s ease-out;
      }

      .modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .modal-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s;
      }

      .modal-close:hover {
        background: #f5f5f5;
        color: #333;
      }

      .modal-body {
        padding: 24px;
      }

      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .modal-button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .modal-button-primary {
        background: #2196f3;
        color: white;
      }

      .modal-button-primary:hover {
        background: #1976d2;
      }

      .modal-button-secondary {
        background: #f5f5f5;
        color: #333;
      }

      .modal-button-secondary:hover {
        background: #e0e0e0;
      }

      .modal-center {
        text-align: center;
      }

      .modal-center .modal-body {
        text-align: center;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `
    document.head.appendChild(style)
  }

  const showModal = (options) => {
    return new Promise((resolve) => {
      createModalContainer()

      const {
        title = 'Modal',
        content = '',
        size = 'medium',
        closable = true,
        showClose = true,
        showFooter = true,
        centered = false,
        buttons = [{
          text: 'OK',
          type: 'primary',
          handler: () => resolve(true)
        }]
      } = options

      const modal = document.createElement('div')
      modal.className = 'modal'

      // Add size classes
      if (size === 'small') {
        modal.style.maxWidth = '400px'
      } else if (size === 'large') {
        modal.style.maxWidth = '80%'
      } else {
        modal.style.maxWidth = '500px'
      }

      modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            ${showClose ? '<button class="modal-close">×</button>' : ''}
          </div>
          <div class="modal-body">
            ${content}
          </div>
          ${showFooter ? `
          <div class="modal-footer">
            ${buttons.map(button => `
              <button class="modal-button modal-button-${button.type || 'secondary'}" data-action="${button.text}">
                ${button.text}
              </button>
            `).join('')}
          </div>
          ` : ''}
        </div>
      `

      // Add centered class if needed
      if (centered) {
        modal.classList.add('modal-center')
      }

      // Close handler
      const closeModal = (result) => {
        modal.style.animation = 'slideUp 0.3s ease-out reverse'
        setTimeout(() => {
          modal.remove()
          // Remove container if empty
          const container = document.querySelector('.modal-container')
          if (container && container.children.length === 0) {
            container.remove()
          }
          resolve(result)
        }, 300)
      }

      // Add close button handler
      const closeButton = modal.querySelector('.modal-close')
      if (closeButton) {
        closeButton.onclick = () => closeModal(false)
      }

      // Add backdrop click handler
      const backdrop = modal.querySelector('.modal-backdrop')
      if (closable) {
        backdrop.onclick = () => closeModal(false)
      }

      // Add button handlers
      const footerButtons = modal.querySelectorAll('.modal-button')
      footerButtons.forEach(button => {
        button.onclick = () => {
          const buttonText = button.dataset.action
          const buttonConfig = buttons.find(btn => btn.text === buttonText)
          if (buttonConfig && buttonConfig.handler) {
            buttonConfig.handler()
          }
          closeModal(buttonConfig?.resolve !== false)
        }
      })

      // Add to container
      modalContainer.appendChild(modal)

      // Focus first button
      const firstButton = modal.querySelector('.modal-button')
      if (firstButton) {
        firstButton.focus()
      }

      // Return close function
      return closeModal
    })
  }

  const alert = (message, title = 'Alert') => {
    return showModal({
      title,
      content: `<p>${message}</p>`,
      size: 'small',
      buttons: [{
        text: 'OK',
        type: 'primary',
        handler: () => {}
      }]
    })
  }

  const confirm = (message, title = 'Confirm') => {
    return showModal({
      title,
      content: `<p>${message}</p>`,
      size: 'small',
      buttons: [
        {
          text: 'Cancel',
          type: 'secondary',
          handler: () => resolve(false)
        },
        {
          text: 'OK',
          type: 'primary',
          handler: () => resolve(true)
        }
      ]
    })
  }

  return {
    show: showModal,
    alert,
    confirm
  }
}

// Loading State Plugin
// Global loading state management
export const createLoadingPlugin = () => {
  const loadingCount = ref(0)
  const isLoading = ref(false)

  const show = (message = 'Loading...') => {
    loadingCount.value++
    isLoading.value = true
    console.log(`Loading: ${message}`)
  }

  const hide = () => {
    loadingCount.value = Math.max(0, loadingCount.value - 1)
    if (loadingCount.value === 0) {
      isLoading.value = false
    }
  }

  const withLoading = async (fn, message) => {
    show(message)
    try {
      return await fn()
    } finally {
      hide()
    }
  }

  const install = (app) => {
    // Provide loading state
    app.config.globalProperties.$loading = {
      show,
      hide,
      withLoading,
      isLoading: isLoading.value
    }

    // Add to provide/inject
    app.provide('loading', {
      show,
      hide,
      isLoading: isLoading,
      withLoading
    })
  }

  return {
    show,
    hide,
    withLoading,
    isLoading,
    install
  }
}

// Storage Plugin
// Wrapper for localStorage and sessionStorage with Vue reactivity
export const createStoragePlugin = () => {
  const createStorageProxy = (storageType) => {
    const storage = window[storageType]

    return {
      set(key, value) {
        try {
          storage.setItem(key, JSON.stringify(value))
          return true
        } catch (error) {
          console.error(`Error saving to ${storageType}:`, error)
          return false
        }
      },

      get(key, defaultValue = null) {
        try {
          const item = storage.getItem(key)
          if (item === null) {
            return defaultValue
          }
          return JSON.parse(item)
        } catch (error) {
          console.error(`Error reading from ${storageType}:`, error)
          return defaultValue
        }
      },

      remove(key) {
        try {
          storage.removeItem(key)
          return true
        } catch (error) {
          console.error(`Error removing from ${storageType}:`, error)
          return false
        }
      },

      clear() {
        try {
          storage.clear()
          return true
        } catch (error) {
          console.error(`Error clearing ${storageType}:`, error)
          return false
        }
      },

      keys() {
        return Object.keys(storage)
      },

      length() {
        return storage.length
      },

      has(key) {
        return storage.getItem(key) !== null
      }
    }
  }

  return {
    localStorage: createStorageProxy('localStorage'),
    sessionStorage: createStorageProxy('sessionStorage')
  }
}

/**
 * Register all plugins with Vue app
 * @param {import('vue').App} app - Vue app instance
 */
export function registerPlugins(app) {
  // Create and install plugins
  const toast = createToastPlugin()
  const modal = createModalPlugin()
  const loading = createLoadingPlugin()
  const storage = createStoragePlugin()
  const eventBus = createEventBus()

  // Install plugins
  loading.install(app)

  // Provide plugins globally
  app.config.globalProperties.$toast = toast
  app.config.globalProperties.$modal = modal
  app.config.globalProperties.$eventBus = eventBus
  app.config.globalProperties.$storage = storage

  // Add to provide/inject
  app.provide('toast', toast)
  app.provide('modal', modal)
  app.provide('storage', storage)
  app.provide('eventBus', eventBus)

  return {
    toast,
    modal,
    loading,
    storage,
    eventBus
  }
}

export default {
  registerPlugins,
  createEventBus,
  createToastPlugin,
  createModalPlugin,
  createLoadingPlugin,
  createStoragePlugin
}