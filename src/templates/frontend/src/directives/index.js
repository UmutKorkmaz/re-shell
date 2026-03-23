import { createApp } from 'vue'

/**
 * Vue 3 Custom Directives
 *
 * This module provides a collection of useful custom directives for Vue 3 applications.
 * Each directive is designed to be reusable, configurable, and follows Vue 3 best practices.
 */

// Custom directive: v-click-outside
// Detects clicks outside an element and calls a handler
const clickOutside = {
  beforeMount(el, binding) {
    // Define handler function
    const handleClick = (event) => {
      // Check if click is outside the element
      if (!(el === event.target || el.contains(event.target))) {
        // Call the handler function
        binding.value(event)
      }
    }

    // Store handler for cleanup
    el.__clickOutside_handler = handleClick

    // Add event listener
    document.addEventListener('click', handleClick)
  },

  unmounted(el) {
    // Remove event listener
    document.removeEventListener('click', el.__clickOutside_handler)
  }
}

// Custom directive: v-tooltip
// Shows tooltip on hover with customizable options
const tooltip = {
  beforeMount(el, binding) {
    // Create tooltip element
    const tooltip = document.createElement('div')
    tooltip.className = 'tooltip'
    tooltip.textContent = binding.value

    // Add tooltip styles
    const style = document.createElement('style')
    style.textContent = `
      .tooltip {
        position: absolute;
        background: #333;
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 14px;
        white-space: nowrap;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
      }

      .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: #333 transparent transparent transparent;
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(tooltip)

    // Store tooltip element
    el.__tooltip = tooltip

    // Store show/hide functions
    el.__showTooltip = (event) => {
      const rect = el.getBoundingClientRect()

      // Position tooltip
      if (binding.arg === 'top') {
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`
        tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`
        tooltip.style.transform = 'none'
        tooltip.style.setProperty('--arrow-top', '100%')
      } else if (binding.arg === 'bottom') {
        tooltip.style.top = `${rect.bottom + 10}px`
        tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`
      } else if (binding.arg === 'left') {
        tooltip.style.top = `${rect.top + (rect.height - tooltip.offsetHeight) / 2}px`
        tooltip.style.left = `${rect.left - tooltip.offsetWidth - 10}px`
        tooltip.style.transform = 'none'
      } else if (binding.arg === 'right') {
        tooltip.style.top = `${rect.top + (rect.height - tooltip.offsetHeight) / 2}px`
        tooltip.style.left = `${rect.right + 10}px`
        tooltip.style.transform = 'none'
      } else {
        // Default: top
        tooltip.style.top = `${rect.bottom + 10}px`
        tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`
      }

      // Show tooltip
      tooltip.style.opacity = '1'
    }

    el.__hideTooltip = () => {
      tooltip.style.opacity = '0'
    }

    // Add event listeners
    el.addEventListener('mouseenter', el.__showTooltip)
    el.addEventListener('mouseleave', el.__hideTooltip)
  },

  updated(el, binding) {
    // Update tooltip content
    if (el.__tooltip) {
      el.__tooltip.textContent = binding.value
    }
  },

  unmounted(el) {
    // Remove event listeners
    if (el.__showTooltip && el.__hideTooltip) {
      el.removeEventListener('mouseenter', el.__showTooltip)
      el.removeEventListener('mouseleave', el.__hideTooltip)
    }

    // Remove tooltip
    if (el.__tooltip) {
      el.__tooltip.remove()
    }
  }
}

// Custom directive: v-loading
// Shows loading state overlay on an element
const loading = {
  beforeMount(el, binding) {
    // Create loading overlay
    const overlay = document.createElement('div')
    overlay.className = 'loading-overlay'

    // Add loading spinner
    const spinner = document.createElement('div')
    spinner.className = 'loading-spinner'
    overlay.appendChild(spinner)

    // Add loading text
    const text = document.createElement('span')
    text.textContent = binding.value || 'Loading...'
    text.className = 'loading-text'
    overlay.appendChild(text)

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        border-radius: inherit;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-text {
        margin-top: 10px;
        color: #333;
        font-size: 14px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `

    document.head.appendChild(style)

    // Store overlay and styles
    el.__loadingOverlay = overlay
    el.__loadingStyle = style

    // Apply loading state if needed
    if (binding.value) {
      el.style.position = 'relative'
      el.appendChild(overlay)
    }
  },

  updated(el, binding) {
    // Toggle loading state
    if (binding.value && !el.__loadingOverlay.parentNode) {
      el.style.position = 'relative'
      el.appendChild(el.__loadingOverlay)
    } else if (!binding.value && el.__loadingOverlay.parentNode) {
      el.removeChild(el.__loadingOverlay)
    }

    // Update loading text
    if (el.__loadingOverlay) {
      const text = el.__loadingOverlay.querySelector('.loading-text')
      if (text) {
        text.textContent = binding.arg || 'Loading...'
      }
    }
  },

  unmounted(el) {
    // Remove overlay and styles
    if (el.__loadingOverlay && el.__loadingOverlay.parentNode) {
      el.removeChild(el.__loadingOverlay)
    }
    if (el.__loadingStyle) {
      el.__loadingStyle.remove()
    }
  }
}

// Custom directive: v-lazy
// Lazy loads images with intersection observer
const lazy = {
  beforeMount(el, binding) {
    // Create image placeholder
    const placeholder = document.createElement('div')
    placeholder.className = 'lazy-placeholder'
    placeholder.style.cssText = `
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    `
    placeholder.textContent = 'Loading image...'

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .lazy-placeholder {
        background-size: cover;
        background-position: center;
        transition: opacity 0.3s;
      }

      .lazy-loaded {
        opacity: 1;
      }

      .lazy-loading {
        opacity: 0.5;
      }
    `

    document.head.appendChild(style)

    // Store element and placeholder
    el.__lazyImage = new Image()
    el.__lazyPlaceholder = placeholder
    el.__lazyStyle = style

    // Handle image load
    el.__lazyImage.onload = () => {
      if (el.__lazyImage) {
        el.src = el.__lazyImage.src
        el.classList.add('lazy-loaded')

        // Replace with loaded image
        setTimeout(() => {
          if (placeholder.parentNode) {
            placeholder.remove()
          }
        }, 300)
      }
    }

    // Handle image error
    el.__lazyImage.onerror = () => {
      placeholder.textContent = 'Failed to load image'
      el.classList.remove('lazy-loading')
    }

    // Add intersection observer
    el.__lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Load image
          el.__lazyImage.src = binding.value
          el.classList.add('lazy-loading')

          // Unobserve
          el.__lazyObserver.unobserve(el)
        }
      })
    }, {
      rootMargin: '50px'
    })

    // Observe element
    el.__lazyObserver.observe(el)

    // Insert placeholder if no image loaded yet
    if (!el.src) {
      el.parentNode.insertBefore(placeholder, el.nextSibling)
    }
  },

  updated(el, binding) {
    // Update image source
    if (binding.value && binding.value !== el.__lazyImage?.src) {
      el.__lazyImage.src = binding.value
    }
  },

  unmounted(el) {
    // Cleanup observer
    if (el.__lazyObserver) {
      el.__lazyObserver.unobserve(el)
    }

    // Remove elements
    if (el.__lazyPlaceholder && el.__lazyPlaceholder.parentNode) {
      el.__lazyPlaceholder.remove()
    }
    if (el.__lazyStyle) {
      el.__lazyStyle.remove()
    }
  }
}

// Custom directive: v-autofocus
// Auto focuses element on mount with options
const autofocus = {
  mounted(el, binding) {
    // Focus after delay if specified
    if (binding.modifiers.delay) {
      const delay = binding.arg || 100
      setTimeout(() => {
        el.focus()
      }, delay)
    } else {
      // Focus immediately
      el.focus()
    }

    // Set focus behavior for input fields
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      // Select all text if specified
      if (binding.modifiers.select) {
        el.select()
      }

      // Set input mode if specified
      if (binding.arg) {
        el.inputMode = binding.arg
      }
    }
  }
}

// Custom directive: v-debounce
// Debounces input events with configurable delay
const debounce = {
  beforeMount(el, binding) {
    // Get debounce delay (default: 300ms)
    const delay = binding.arg || 300

    // Create debounced function
    let timeoutId
    el.__debounceHandler = (event) => {
      // Clear existing timeout
      clearTimeout(timeoutId)

      // Set new timeout
      timeoutId = setTimeout(() => {
        // Call handler function
        binding.value(event)
      }, delay)
    }

    // Add event listener
    el.addEventListener('input', el.__debounceHandler)

    // Add event listener for debounce modifiers
    if (binding.modifiers.keyup) {
      el.addEventListener('keyup', el.__debounceHandler)
    }

    if (binding.modifiers.change) {
      el.addEventListener('change', el.__debounceHandler)
    }
  },

  unmounted(el) {
    // Remove event listeners
    if (el.__debounceHandler) {
      el.removeEventListener('input', el.__debounceHandler)
      el.removeEventListener('keyup', el.__debounceHandler)
      el.removeEventListener('change', el.__debounceHandler)
    }
  }
}

/**
 * Register all directives with Vue app
 * @param {import('vue').App} app - Vue app instance
 */
export function registerDirectives(app) {
  // Register all directives
  app.directive('click-outside', clickOutside)
  app.directive('tooltip', tooltip)
  app.directive('loading', loading)
  app.directive('lazy', lazy)
  app.directive('autofocus', autofocus)
  app.directive('debounce', debounce)
}

export default {
  registerDirectives,
  clickOutside,
  tooltip,
  loading,
  lazy,
  autofocus,
  debounce
}