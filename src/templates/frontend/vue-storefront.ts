import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class VueStorefrontTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Nuxt config (Vue Storefront is built on Nuxt)
    files.push({
      path: 'nuxt.config.ts',
      content: this.generateNuxtConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // App configuration
    files.push({
      path: 'app.config.ts',
      content: this.generateAppConfig()
    });

    // Tailwind config
    files.push({
      path: 'tailwind.config.js',
      content: this.generateTailwindConfig()
    });

    // Nuxt app
    files.push({
      path: 'app/app.vue',
      content: this.generateAppVue()
    });

    // Pages
    files.push({
      path: 'app/pages/index.vue',
      content: this.generateHomePage()
    });

    files.push({
      path: 'app/pages/category/[slug].vue',
      content: this.generateCategoryPage()
    });

    files.push({
      path: 'app/pages/product/[slug].vue',
      content: this.generateProductPage()
    });

    files.push({
      path: 'app/pages/cart.vue',
      content: this.generateCartPage()
    });

    files.push({
      path: 'app/pages/checkout.vue',
      content: this.generateCheckoutPage()
    });

    files.push({
      path: 'app/pages/account/index.vue',
      content: this.generateAccountPage()
    });

    files.push({
      path: 'app/pages/account/orders.vue',
      content: this.generateOrdersPage()
    });

    // Components
    files.push({
      path: 'app/components/ProductCard.vue',
      content: this.generateProductCard()
    });

    files.push({
      path: 'app/components/ProductGallery.vue',
      content: this.generateProductGallery()
    });

    files.push({
      path: 'app/components/CartItem.vue',
      content: this.generateCartItem()
    });

    files.push({
      path: 'app/components/CartSidebar.vue',
      content: this.generateCartSidebar()
    });

    files.push({
      path: 'app/components/CategoryFilters.vue',
      content: this.generateCategoryFilters()
    });

    files.push({
      path: 'app/components/SearchModal.vue',
      content: this.generateSearchModal()
    });

    files.push({
      path: 'app/components/AppHeader.vue',
      content: this.generateHeader()
    });

    files.push({
      path: 'app/components/AppFooter.vue',
      content: this.generateFooter()
    });

    files.push({
      path: 'app/components/MiniCart.vue',
      content: this.generateMiniCart()
    });

    // Composables
    files.push({
      path: 'app/composables/useCart.ts',
      content: this.generateCartComposable()
    });

    files.push({
      path: 'app/composables/useProduct.ts',
      content: this.generateProductComposable()
    });

    files.push({
      path: 'app/composables/useCategory.ts',
      content: this.generateCategoryComposable()
    });

    files.push({
      path: 'app/composables/useUser.ts',
      content: this.generateUserComposable()
    });

    files.push({
      path: 'app/composables/useWishlist.ts',
      content: this.generateWishlistComposable()
    });

    files.push({
      path: 'app/composables/useCheckout.ts',
      content: this.generateCheckoutComposable()
    });

    // Stores (Pinia)
    files.push({
      path: 'app/stores/cart.ts',
      content: this.generateCartStore()
    });

    files.push({
      path: 'app/stores/user.ts',
      content: this.generateUserStore()
    });

    files.push({
      path: 'app/stores/wishlist.ts',
      content: this.generateWishlistStore()
    });

    // Server API routes
    files.push({
      path: 'app/server/api/products/index.get.ts',
      content: this.generateProductsApi()
    });

    files.push({
      path: 'app/server/api/products/[slug].get.ts',
      content: this.generateProductDetailApi()
    });

    files.push({
      path: 'app/server/api/categories/index.get.ts',
      content: this.generateCategoriesApi()
    });

    files.push({
      path: 'app/server/api/cart/index.ts',
      content: this.generateCartApi()
    });

    // Types
    files.push({
      path: 'app/types/index.ts',
      content: this.generateTypes()
    });

    // Middleware
    files.push({
      path: 'app/middleware/auth.ts',
      content: this.generateAuthMiddleware()
    });

    // Layouts
    files.push({
      path: 'app/layouts/default.vue',
      content: this.generateDefaultLayout()
    });

    files.push({
      path: 'app/layouts/checkout.vue',
      content: this.generateCheckoutLayout()
    });

    // Plugins
    files.push({
      path: 'app/plugins/commerce.ts',
      content: this.generateCommercePlugin()
    });

    // CSS
    files.push({
      path: 'app/assets/css/main.css',
      content: this.generateMainCss()
    });

    // Environment
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      private: true,
      type: 'module',
      scripts: {
        dev: 'nuxt dev',
        build: 'nuxt build',
        generate: 'nuxt generate',
        preview: 'nuxt preview',
        postinstall: 'nuxt prepare',
        test: 'vitest',
        'test:e2e': 'playwright test'
      },
      dependencies: {
        '@vuestorefront/sdk': '^3.0.0',
        '@vuestorefront/middleware': '^3.0.0',
        'nuxt': '^3.10.0',
        '@nuxtjs/tailwindcss': '^6.10.0',
        '@pinia/nuxt': '^0.5.1',
        '@pinia/plugin-persistedstate': '^3.2.1',
        '@vueuse/nuxt': '^10.7.2',
        '@nuxtjs/i18n': '^8.3.0',
        '@nuxt/image': '^1.3.0',
        'vue': '^3.4.0',
        'pinia': '^2.1.7',
        'swiper': '^11.0.5',
        'stripe': '^14.14.0'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        'typescript': '^5.3.3',
        'autoprefixer': '^10.4.17',
        'postcss': '^8.4.33',
        'tailwindcss': '^3.4.1',
        'vitest': '^1.2.0',
        '@playwright/test': '^1.41.0',
        '@nuxt/test-utils': '^3.11.0'
      }
    };
  }

  protected generateNuxtConfig() {
    return `// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/image',
  ],

  app: {
    head: {
      title: '${this.context.name} - E-commerce Store',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '${this.context.description || 'Modern e-commerce store built with Vue Storefront'}' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.API_URL || '/api',
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
    },
    private: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
      commerceApiKey: process.env.COMMERCE_API_KEY || '',
    }
  },

  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English' },
      { code: 'de', iso: 'de-DE', name: 'Deutsch' },
      { code: 'fr', iso: 'fr-FR', name: 'Français' }
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default'
  },

  image: {
    provider: 'ipx',
    quality: 80,
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536
    }
  },

  pinia: {
    storesDirs: ['./stores/**'],
  },

  vite: {
    optimizeDeps: {
      include: ['@vueuse/core', 'pinia'],
    }
  }
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: './.nuxt/tsconfig.json',
      compilerOptions: {
        strict: true,
        types: ['@nuxt/types', '@pinia/nuxt'],
        paths: {
          '@': ['.'],
          '~': ['.'],
          '@@': ['.'],
          '~~': ['.']
        }
      }
    }, null, 2);
  }

  protected generateAppConfig() {
    return `// App configuration for Vue Storefront e-commerce
export default defineAppConfig({
  title: '${this.context.name}',
  description: '${this.context.description || 'Modern e-commerce store'}',
  currency: 'USD',
  currencySymbol: '$',
  locale: 'en-US',
  theme: {
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
  },
  cart: {
    maxQuantity: 10,
    persistCart: true,
  },
  checkout: {
    guestCheckout: true,
    paymentMethods: ['stripe', 'paypal'],
    shippingMethods: ['standard', 'express', 'overnight']
  }
});
`;
  }

  protected generateTailwindConfig() {
    return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
`;
  }

  protected generateAppVue() {
    return `<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NuxtLoadingIndicator color="#3b82f6" />
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>
`;
  }

  protected generateHomePage() {
    return `<script setup lang="ts">
import { useProduct } from '~/composables/useProduct'
import { useCategory } from '~/composables/useCategory'

const { products, loading: productsLoading } = useProduct()
const { categories } = useCategory()

useSeoMeta({
  title: '${this.context.name} - Home',
  description: 'Discover our latest products and best deals'
})

const featuredProducts = computed(() => products.value.slice(0, 8))
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-r from-primary-600 to-primary-800 text-white">
      <div class="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div class="text-center">
          <h1 class="text-4xl md:text-6xl font-bold mb-6">
            Welcome to ${this.context.name}
          </h1>
          <p class="text-xl md:text-2xl mb-8 opacity-90">
            Discover amazing products at great prices
          </p>
          <NuxtLink
            to="/category/all"
            class="inline-block bg-white text-primary-600 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors"
          >
            Shop Now
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Categories Section -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-12">Shop by Category</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <NuxtLink
            v-for="category in categories"
            :key="category.id"
            :to="\`/category/\${category.slug}\`"
            class="group relative overflow-hidden rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
          >
            <div class="aspect-square">
              <NuxtImg
                :src="category.image || '/placeholder.jpg'"
                :alt="category.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
              <h3 class="text-white text-xl font-semibold">{{ category.name }}</h3>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Featured Products -->
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-12">Featured Products</h2>

        <div v-if="productsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div v-for="i in 8" :key="i" class="animate-pulse">
            <div class="aspect-square bg-gray-200 rounded-lg mb-4"></div>
            <div class="h-4 bg-gray-200 rounded mb-2"></div>
            <div class="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ProductCard
            v-for="product in featuredProducts"
            :key="product.id"
            :product="product"
          />
        </div>

        <div class="text-center mt-12">
          <NuxtLink
            to="/category/all"
            class="inline-block border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-full font-semibold hover:bg-primary-600 hover:text-white transition-colors"
          >
            View All Products
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Newsletter Section -->
    <section class="py-16 bg-primary-600 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-bold mb-4">Subscribe to Our Newsletter</h2>
        <p class="text-lg mb-8 opacity-90">Get the latest updates on new products and upcoming sales</p>
        <form @submit.prevent class="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            class="flex-1 px-4 py-3 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            class="px-8 py-3 bg-white text-primary-600 rounded-full font-semibold hover:bg-gray-100 transition-colors"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  </div>
</template>
`;
  }

  protected generateCategoryPage() {
    return `<script setup lang="ts">
import { useProduct } from '~/composables/useProduct'
import { useCategory } from '~/composables/useCategory'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { products, loading, searchProducts } = useProduct()
const { getCategoryBySlug } = useCategory()

const category = computed(() => getCategoryBySlug(slug.value))

const filters = ref({
  priceMin: 0,
  priceMax: 1000,
  sortBy: 'newest',
  inStock: false
})

const filteredProducts = computed(() => {
  let result = [...products.value]

  if (slug.value !== 'all') {
    result = result.filter(p => p.categorySlug === slug.value)
  }

  result = result.filter(p =>
    p.price >= filters.value.priceMin &&
    p.price <= filters.value.priceMax
  )

  if (filters.value.inStock) {
    result = result.filter(p => p.inStock)
  }

  switch (filters.value.sortBy) {
    case 'price-asc':
      result.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      result.sort((a, b) => b.price - a.price)
      break
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
  }

  return result
})

useSeoMeta({
  title: \`\${category.value?.name || 'All Products'} - ${this.context.name}\`,
  description: category.value?.description || 'Browse our product collection'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Breadcrumb -->
      <nav class="mb-8">
        <ol class="flex items-center space-x-2 text-sm">
          <li>
            <NuxtLink to="/" class="text-gray-500 hover:text-primary-600">Home</NuxtLink>
          </li>
          <li class="text-gray-400">/</li>
          <li class="text-gray-900 font-medium">{{ category?.name || 'All Products' }}</li>
        </ol>
      </nav>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Filters Sidebar -->
        <aside class="w-full lg:w-64 flex-shrink-0">
          <CategoryFilters v-model:filters="filters" />
        </aside>

        <!-- Products Grid -->
        <div class="flex-1">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">{{ category?.name || 'All Products' }}</h1>
            <span class="text-gray-500">{{ filteredProducts.length }} products</span>
          </div>

          <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div v-for="i in 9" :key="i" class="animate-pulse">
              <div class="aspect-square bg-gray-200 rounded-lg mb-4"></div>
              <div class="h-4 bg-gray-200 rounded mb-2"></div>
              <div class="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>

          <div v-else-if="filteredProducts.length === 0" class="text-center py-12">
            <p class="text-gray-500 text-lg">No products found</p>
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ProductCard
              v-for="product in filteredProducts"
              :key="product.id"
              :product="product"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateProductPage() {
    return `<script setup lang="ts">
import { useProduct } from '~/composables/useProduct'
import { useCart } from '~/composables/useCart'
import { useWishlist } from '~/composables/useWishlist'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { getProductBySlug, products } = useProduct()
const { addToCart } = useCart()
const { toggleWishlist, isInWishlist } = useWishlist()

const product = computed(() => getProductBySlug(slug.value))
const quantity = ref(1)
const selectedVariant = ref<string | null>(null)
const activeImageIndex = ref(0)

const relatedProducts = computed(() =>
  products.value
    .filter(p => p.categorySlug === product.value?.categorySlug && p.id !== product.value?.id)
    .slice(0, 4)
)

const handleAddToCart = () => {
  if (product.value) {
    addToCart(product.value, quantity.value, selectedVariant.value)
  }
}

useSeoMeta({
  title: product.value?.name ? \`\${product.value.name} - ${this.context.name}\` : '${this.context.name}',
  description: product.value?.description || '',
  ogImage: product.value?.images?.[0]
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <div v-if="!product" class="max-w-7xl mx-auto px-4 py-16 text-center">
      <p class="text-gray-500 text-lg">Product not found</p>
      <NuxtLink to="/category/all" class="text-primary-600 hover:underline mt-4 inline-block">
        Browse all products
      </NuxtLink>
    </div>

    <div v-else class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Breadcrumb -->
      <nav class="mb-8">
        <ol class="flex items-center space-x-2 text-sm">
          <li>
            <NuxtLink to="/" class="text-gray-500 hover:text-primary-600">Home</NuxtLink>
          </li>
          <li class="text-gray-400">/</li>
          <li>
            <NuxtLink :to="\`/category/\${product.categorySlug}\`" class="text-gray-500 hover:text-primary-600">
              {{ product.categoryName }}
            </NuxtLink>
          </li>
          <li class="text-gray-400">/</li>
          <li class="text-gray-900 font-medium">{{ product.name }}</li>
        </ol>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <!-- Product Gallery -->
        <ProductGallery :images="product.images" :alt="product.name" />

        <!-- Product Info -->
        <div class="space-y-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">{{ product.name }}</h1>
            <div class="flex items-center mt-2 space-x-4">
              <div class="flex items-center">
                <span v-for="i in 5" :key="i" class="text-yellow-400">
                  {{ i <= Math.round(product.rating || 0) ? '★' : '☆' }}
                </span>
                <span class="ml-2 text-sm text-gray-500">({{ product.reviewCount || 0 }} reviews)</span>
              </div>
            </div>
          </div>

          <div class="flex items-baseline space-x-4">
            <span class="text-3xl font-bold text-gray-900">\${{ product.price.toFixed(2) }}</span>
            <span v-if="product.originalPrice" class="text-xl text-gray-500 line-through">
              \${{ product.originalPrice.toFixed(2) }}
            </span>
            <span v-if="product.originalPrice" class="text-sm font-medium text-green-600">
              Save {{ Math.round((1 - product.price / product.originalPrice) * 100) }}%
            </span>
          </div>

          <p class="text-gray-600">{{ product.description }}</p>

          <!-- Variants -->
          <div v-if="product.variants?.length" class="space-y-4">
            <label class="block text-sm font-medium text-gray-700">Select Option</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="variant in product.variants"
                :key="variant"
                @click="selectedVariant = variant"
                :class="[
                  'px-4 py-2 border rounded-lg transition-colors',
                  selectedVariant === variant
                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                    : 'border-gray-300 hover:border-gray-400'
                ]"
              >
                {{ variant }}
              </button>
            </div>
          </div>

          <!-- Quantity -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Quantity</label>
            <div class="flex items-center space-x-4">
              <button
                @click="quantity = Math.max(1, quantity - 1)"
                class="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
              >
                -
              </button>
              <span class="text-lg font-medium w-8 text-center">{{ quantity }}</span>
              <button
                @click="quantity++"
                class="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          <!-- Stock Status -->
          <div class="flex items-center space-x-2">
            <span
              :class="product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              class="px-3 py-1 rounded-full text-sm font-medium"
            >
              {{ product.inStock ? 'In Stock' : 'Out of Stock' }}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex space-x-4">
            <button
              @click="handleAddToCart"
              :disabled="!product.inStock"
              class="flex-1 bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
            <button
              @click="toggleWishlist(product)"
              class="w-14 h-14 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <span :class="isInWishlist(product.id) ? 'text-red-500' : 'text-gray-400'">
                ❤
              </span>
            </button>
          </div>

          <!-- Product Details -->
          <div class="border-t pt-6 space-y-4">
            <h3 class="font-semibold">Product Details</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li v-if="product.sku">SKU: {{ product.sku }}</li>
              <li v-if="product.brand">Brand: {{ product.brand }}</li>
              <li v-if="product.material">Material: {{ product.material }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Related Products -->
      <section v-if="relatedProducts.length" class="mt-16">
        <h2 class="text-2xl font-bold mb-8">You May Also Like</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ProductCard
            v-for="relatedProduct in relatedProducts"
            :key="relatedProduct.id"
            :product="relatedProduct"
          />
        </div>
      </section>
    </div>
  </div>
</template>
`;
  }

  protected generateCartPage() {
    return `<script setup lang="ts">
import { useCart } from '~/composables/useCart'

const { cartItems, cartTotal, cartCount, removeFromCart, updateQuantity, clearCart } = useCart()

useSeoMeta({
  title: 'Shopping Cart - ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-8">Shopping Cart</h1>

      <div v-if="cartCount === 0" class="text-center py-16">
        <p class="text-gray-500 text-lg mb-4">Your cart is empty</p>
        <NuxtLink
          to="/category/all"
          class="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          Continue Shopping
        </NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Cart Items -->
        <div class="lg:col-span-2 space-y-4">
          <CartItem
            v-for="item in cartItems"
            :key="item.product.id"
            :item="item"
            @update-quantity="(qty) => updateQuantity(item.product.id, qty)"
            @remove="removeFromCart(item.product.id)"
          />

          <button
            @click="clearCart"
            class="text-red-600 hover:text-red-700 font-medium"
          >
            Clear Cart
          </button>
        </div>

        <!-- Order Summary -->
        <div class="bg-white p-6 rounded-lg shadow-sm h-fit">
          <h2 class="text-xl font-semibold mb-4">Order Summary</h2>

          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Subtotal ({{ cartCount }} items)</span>
              <span>\${{ cartTotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Tax</span>
              <span>Calculated at checkout</span>
            </div>
          </div>

          <div class="border-t mt-4 pt-4">
            <div class="flex justify-between text-lg font-semibold">
              <span>Estimated Total</span>
              <span>\${{ cartTotal.toFixed(2) }}</span>
            </div>
          </div>

          <NuxtLink
            to="/checkout"
            class="w-full mt-6 block text-center bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Proceed to Checkout
          </NuxtLink>

          <NuxtLink
            to="/category/all"
            class="w-full mt-3 block text-center text-primary-600 hover:text-primary-700 font-medium"
          >
            Continue Shopping
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateCheckoutPage() {
    return `<script setup lang="ts">
import { useCart } from '~/composables/useCart'
import { useCheckout } from '~/composables/useCheckout'
import { useUser } from '~/composables/useUser'

definePageMeta({
  layout: 'checkout'
})

const { cartItems, cartTotal } = useCart()
const { processCheckout, loading, error } = useCheckout()
const { user, isAuthenticated } = useUser()

const step = ref(1)
const shippingAddress = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US'
})

const billingAddress = ref({
  sameAsShipping: true,
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US'
})

const paymentMethod = ref('stripe')
const shippingMethod = ref('standard')

const shippingCost = computed(() => {
  switch (shippingMethod.value) {
    case 'express': return 15.00
    case 'overnight': return 25.00
    default: return 5.00
  }
})

const tax = computed(() => cartTotal.value * 0.08)
const total = computed(() => cartTotal.value + shippingCost.value + tax.value)

const handleSubmit = async () => {
  await processCheckout({
    items: cartItems.value,
    shippingAddress: shippingAddress.value,
    billingAddress: billingAddress.value.sameAsShipping ? shippingAddress.value : billingAddress.value,
    paymentMethod: paymentMethod.value,
    shippingMethod: shippingMethod.value,
    total: total.value
  })
}

useSeoMeta({
  title: 'Checkout - ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-8">Checkout</h1>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Checkout Form -->
        <div class="lg:col-span-2 space-y-8">
          <!-- Steps Indicator -->
          <div class="flex items-center justify-between mb-8">
            <div
              v-for="s in 3"
              :key="s"
              :class="[
                'flex items-center',
                s < 3 ? 'flex-1' : ''
              ]"
            >
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                  step >= s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                ]"
              >
                {{ s }}
              </div>
              <span class="ml-2 text-sm font-medium" :class="step >= s ? 'text-primary-600' : 'text-gray-500'">
                {{ s === 1 ? 'Shipping' : s === 2 ? 'Payment' : 'Review' }}
              </span>
              <div v-if="s < 3" class="flex-1 h-px bg-gray-200 mx-4"></div>
            </div>
          </div>

          <!-- Step 1: Shipping -->
          <div v-if="step === 1" class="bg-white p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold mb-6">Shipping Address</h2>
            <form @submit.prevent="step = 2" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    v-model="shippingAddress.firstName"
                    type="text"
                    required
                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    v-model="shippingAddress.lastName"
                    type="text"
                    required
                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  v-model="shippingAddress.email"
                  type="email"
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  v-model="shippingAddress.address"
                  type="text"
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    v-model="shippingAddress.city"
                    type="text"
                    required
                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    v-model="shippingAddress.zipCode"
                    type="text"
                    required
                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <!-- Shipping Method -->
              <div class="mt-6">
                <h3 class="font-medium mb-3">Shipping Method</h3>
                <div class="space-y-2">
                  <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input v-model="shippingMethod" type="radio" value="standard" class="mr-3" />
                    <div class="flex-1">
                      <span class="font-medium">Standard Shipping</span>
                      <span class="text-gray-500 text-sm block">5-7 business days</span>
                    </div>
                    <span class="font-medium">$5.00</span>
                  </label>
                  <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input v-model="shippingMethod" type="radio" value="express" class="mr-3" />
                    <div class="flex-1">
                      <span class="font-medium">Express Shipping</span>
                      <span class="text-gray-500 text-sm block">2-3 business days</span>
                    </div>
                    <span class="font-medium">$15.00</span>
                  </label>
                  <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input v-model="shippingMethod" type="radio" value="overnight" class="mr-3" />
                    <div class="flex-1">
                      <span class="font-medium">Overnight Shipping</span>
                      <span class="text-gray-500 text-sm block">Next business day</span>
                    </div>
                    <span class="font-medium">$25.00</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                class="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Continue to Payment
              </button>
            </form>
          </div>

          <!-- Step 2: Payment -->
          <div v-if="step === 2" class="bg-white p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold mb-6">Payment Method</h2>
            <div class="space-y-4">
              <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input v-model="paymentMethod" type="radio" value="stripe" class="mr-3" />
                <span class="font-medium">Credit Card (Stripe)</span>
              </label>
              <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input v-model="paymentMethod" type="radio" value="paypal" class="mr-3" />
                <span class="font-medium">PayPal</span>
              </label>
            </div>

            <div class="flex gap-4 mt-6">
              <button
                @click="step = 1"
                class="flex-1 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                @click="step = 3"
                class="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Review Order
              </button>
            </div>
          </div>

          <!-- Step 3: Review -->
          <div v-if="step === 3" class="bg-white p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold mb-6">Review Your Order</h2>

            <div class="space-y-4 mb-6">
              <div v-for="item in cartItems" :key="item.product.id" class="flex gap-4 py-4 border-b">
                <NuxtImg
                  :src="item.product.images?.[0] || '/placeholder.jpg'"
                  :alt="item.product.name"
                  class="w-16 h-16 object-cover rounded"
                />
                <div class="flex-1">
                  <h3 class="font-medium">{{ item.product.name }}</h3>
                  <p class="text-sm text-gray-500">Qty: {{ item.quantity }}</p>
                </div>
                <span class="font-medium">\${{ (item.product.price * item.quantity).toFixed(2) }}</span>
              </div>
            </div>

            <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
              {{ error }}
            </div>

            <div class="flex gap-4">
              <button
                @click="step = 2"
                class="flex-1 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                @click="handleSubmit"
                :disabled="loading"
                class="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-300"
              >
                {{ loading ? 'Processing...' : 'Place Order' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="bg-white p-6 rounded-lg shadow-sm h-fit">
          <h2 class="text-xl font-semibold mb-4">Order Summary</h2>

          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Subtotal</span>
              <span>\${{ cartTotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Shipping</span>
              <span>\${{ shippingCost.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Tax</span>
              <span>\${{ tax.toFixed(2) }}</span>
            </div>
          </div>

          <div class="border-t mt-4 pt-4">
            <div class="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>\${{ total.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateAccountPage() {
    return `<script setup lang="ts">
import { useUser } from '~/composables/useUser'

definePageMeta({
  middleware: 'auth'
})

const { user, logout } = useUser()

useSeoMeta({
  title: 'My Account - ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-8">My Account</h1>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- Sidebar -->
        <aside class="space-y-2">
          <NuxtLink
            to="/account"
            class="block px-4 py-2 rounded-lg bg-primary-50 text-primary-600 font-medium"
          >
            Dashboard
          </NuxtLink>
          <NuxtLink
            to="/account/orders"
            class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            Orders
          </NuxtLink>
          <NuxtLink
            to="/account/wishlist"
            class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            Wishlist
          </NuxtLink>
          <NuxtLink
            to="/account/addresses"
            class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            Addresses
          </NuxtLink>
          <button
            @click="logout"
            class="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-red-600"
          >
            Logout
          </button>
        </aside>

        <!-- Main Content -->
        <div class="md:col-span-3">
          <div class="bg-white p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold mb-6">Welcome back, {{ user?.firstName }}!</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NuxtLink to="/account/orders" class="p-4 border rounded-lg hover:border-primary-600 transition-colors">
                <h3 class="font-medium">Orders</h3>
                <p class="text-sm text-gray-500">View your order history</p>
              </NuxtLink>
              <NuxtLink to="/account/wishlist" class="p-4 border rounded-lg hover:border-primary-600 transition-colors">
                <h3 class="font-medium">Wishlist</h3>
                <p class="text-sm text-gray-500">Products you've saved</p>
              </NuxtLink>
              <NuxtLink to="/account/addresses" class="p-4 border rounded-lg hover:border-primary-600 transition-colors">
                <h3 class="font-medium">Addresses</h3>
                <p class="text-sm text-gray-500">Manage shipping addresses</p>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateOrdersPage() {
    return `<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const orders = ref([
  {
    id: 'ORD-001',
    date: '2024-01-15',
    status: 'delivered',
    total: 149.99,
    items: 3
  },
  {
    id: 'ORD-002',
    date: '2024-01-10',
    status: 'shipped',
    total: 89.50,
    items: 2
  }
])

const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered': return 'bg-green-100 text-green-800'
    case 'shipped': return 'bg-blue-100 text-blue-800'
    case 'processing': return 'bg-yellow-100 text-yellow-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

useSeoMeta({
  title: 'My Orders - ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-8">My Orders</h1>

      <div v-if="orders.length === 0" class="text-center py-16">
        <p class="text-gray-500 text-lg mb-4">You haven't placed any orders yet</p>
        <NuxtLink
          to="/category/all"
          class="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          Start Shopping
        </NuxtLink>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="order in orders"
          :key="order.id"
          class="bg-white p-6 rounded-lg shadow-sm"
        >
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-semibold">{{ order.id }}</h3>
              <p class="text-sm text-gray-500">{{ order.date }}</p>
            </div>
            <span
              :class="getStatusColor(order.status)"
              class="px-3 py-1 rounded-full text-sm font-medium capitalize"
            >
              {{ order.status }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-600">{{ order.items }} items</span>
            <span class="font-semibold">\${{ order.total.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateProductCard() {
    return `<script setup lang="ts">
import type { Product } from '~/types'
import { useCart } from '~/composables/useCart'
import { useWishlist } from '~/composables/useWishlist'

const props = defineProps<{
  product: Product
}>()

const { addToCart } = useCart()
const { toggleWishlist, isInWishlist } = useWishlist()

const handleAddToCart = (e: Event) => {
  e.preventDefault()
  addToCart(props.product, 1)
}
</script>

<template>
  <NuxtLink
    :to="\`/product/\${product.slug}\`"
    class="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
  >
    <div class="relative aspect-square overflow-hidden rounded-t-lg">
      <NuxtImg
        :src="product.images?.[0] || '/placeholder.jpg'"
        :alt="product.name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />

      <!-- Wishlist Button -->
      <button
        @click.prevent="toggleWishlist(product)"
        class="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        <span :class="isInWishlist(product.id) ? 'text-red-500' : 'text-gray-400'">❤</span>
      </button>

      <!-- Sale Badge -->
      <span
        v-if="product.originalPrice"
        class="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 text-xs font-semibold rounded"
      >
        Sale
      </span>

      <!-- Quick Add Button -->
      <button
        v-if="product.inStock"
        @click.prevent="handleAddToCart"
        class="absolute bottom-0 left-0 right-0 bg-primary-600 text-white py-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Quick Add
      </button>
    </div>

    <div class="p-4">
      <h3 class="font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
        {{ product.name }}
      </h3>

      <div class="flex items-center mt-1">
        <span v-for="i in 5" :key="i" class="text-yellow-400 text-sm">
          {{ i <= Math.round(product.rating || 0) ? '★' : '☆' }}
        </span>
        <span class="text-xs text-gray-500 ml-1">({{ product.reviewCount || 0 }})</span>
      </div>

      <div class="flex items-baseline mt-2 space-x-2">
        <span class="text-lg font-bold text-gray-900">\${{ product.price.toFixed(2) }}</span>
        <span v-if="product.originalPrice" class="text-sm text-gray-500 line-through">
          \${{ product.originalPrice.toFixed(2) }}
        </span>
      </div>

      <span
        v-if="!product.inStock"
        class="text-xs text-red-600 mt-2 inline-block"
      >
        Out of Stock
      </span>
    </div>
  </NuxtLink>
</template>
`;
  }

  protected generateProductGallery() {
    return `<script setup lang="ts">
const props = defineProps<{
  images: string[]
  alt: string
}>()

const activeIndex = ref(0)
</script>

<template>
  <div class="space-y-4">
    <!-- Main Image -->
    <div class="aspect-square overflow-hidden rounded-lg bg-gray-100">
      <NuxtImg
        :src="images[activeIndex] || '/placeholder.jpg'"
        :alt="alt"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Thumbnails -->
    <div v-if="images.length > 1" class="flex gap-2 overflow-x-auto">
      <button
        v-for="(image, index) in images"
        :key="index"
        @click="activeIndex = index"
        :class="[
          'w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors',
          activeIndex === index ? 'border-primary-600' : 'border-transparent hover:border-gray-300'
        ]"
      >
        <NuxtImg
          :src="image"
          :alt="\`\${alt} thumbnail \${index + 1}\`"
          class="w-full h-full object-cover"
        />
      </button>
    </div>
  </div>
</template>
`;
  }

  protected generateCartItem() {
    return `<script setup lang="ts">
import type { CartItem } from '~/types'

const props = defineProps<{
  item: CartItem
}>()

const emit = defineEmits<{
  (e: 'updateQuantity', quantity: number): void
  (e: 'remove'): void
}>()
</script>

<template>
  <div class="flex gap-4 p-4 bg-white rounded-lg shadow-sm">
    <NuxtLink :to="\`/product/\${item.product.slug}\`" class="flex-shrink-0">
      <NuxtImg
        :src="item.product.images?.[0] || '/placeholder.jpg'"
        :alt="item.product.name"
        class="w-24 h-24 object-cover rounded-lg"
      />
    </NuxtLink>

    <div class="flex-1 min-w-0">
      <NuxtLink :to="\`/product/\${item.product.slug}\`">
        <h3 class="font-medium text-gray-900 hover:text-primary-600 transition-colors">
          {{ item.product.name }}
        </h3>
      </NuxtLink>

      <p v-if="item.variant" class="text-sm text-gray-500 mt-1">
        {{ item.variant }}
      </p>

      <div class="flex items-center justify-between mt-4">
        <div class="flex items-center space-x-2">
          <button
            @click="emit('updateQuantity', Math.max(1, item.quantity - 1))"
            class="w-8 h-8 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
          >
            -
          </button>
          <span class="w-8 text-center">{{ item.quantity }}</span>
          <button
            @click="emit('updateQuantity', item.quantity + 1)"
            class="w-8 h-8 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
          >
            +
          </button>
        </div>

        <span class="font-semibold">\${{ (item.product.price * item.quantity).toFixed(2) }}</span>
      </div>
    </div>

    <button
      @click="emit('remove')"
      class="text-gray-400 hover:text-red-600 transition-colors"
    >
      ✕
    </button>
  </div>
</template>
`;
  }

  protected generateCartSidebar() {
    return `<script setup lang="ts">
import { useCart } from '~/composables/useCart'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { cartItems, cartTotal, cartCount, removeFromCart } = useCart()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-40" @click="emit('close')"></div>
    </Transition>

    <Transition name="slide">
      <div
        v-if="isOpen"
        class="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
      >
        <div class="flex items-center justify-between p-4 border-b">
          <h2 class="text-lg font-semibold">Shopping Cart ({{ cartCount }})</h2>
          <button @click="emit('close')" class="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div v-if="cartCount === 0" class="flex-1 flex items-center justify-center">
          <p class="text-gray-500">Your cart is empty</p>
        </div>

        <div v-else class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-for="item in cartItems"
            :key="item.product.id"
            class="flex gap-4"
          >
            <NuxtImg
              :src="item.product.images?.[0] || '/placeholder.jpg'"
              :alt="item.product.name"
              class="w-16 h-16 object-cover rounded"
            />
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium truncate">{{ item.product.name }}</h3>
              <p class="text-sm text-gray-500">Qty: {{ item.quantity }}</p>
              <p class="text-sm font-medium">\${{ (item.product.price * item.quantity).toFixed(2) }}</p>
            </div>
            <button
              @click="removeFromCart(item.product.id)"
              class="text-gray-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div v-if="cartCount > 0" class="p-4 border-t space-y-4">
          <div class="flex justify-between text-lg font-semibold">
            <span>Subtotal</span>
            <span>\${{ cartTotal.toFixed(2) }}</span>
          </div>
          <NuxtLink
            to="/cart"
            @click="emit('close')"
            class="block w-full text-center border border-primary-600 text-primary-600 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            View Cart
          </NuxtLink>
          <NuxtLink
            to="/checkout"
            @click="emit('close')"
            class="block w-full text-center bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Checkout
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
`;
  }

  protected generateCategoryFilters() {
    return `<script setup lang="ts">
const props = defineProps<{
  filters: {
    priceMin: number
    priceMax: number
    sortBy: string
    inStock: boolean
  }
}>()

const emit = defineEmits<{
  (e: 'update:filters', value: typeof props.filters): void
}>()

const localFilters = computed({
  get: () => props.filters,
  set: (value) => emit('update:filters', value)
})
</script>

<template>
  <div class="bg-white p-6 rounded-lg shadow-sm space-y-6">
    <h3 class="font-semibold text-lg">Filters</h3>

    <!-- Sort By -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
      <select
        v-model="localFilters.sortBy"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name">Name</option>
      </select>
    </div>

    <!-- Price Range -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
      <div class="flex items-center gap-2">
        <input
          v-model.number="localFilters.priceMin"
          type="number"
          min="0"
          placeholder="Min"
          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <span class="text-gray-400">-</span>
        <input
          v-model.number="localFilters.priceMax"
          type="number"
          min="0"
          placeholder="Max"
          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- In Stock -->
    <div>
      <label class="flex items-center cursor-pointer">
        <input
          v-model="localFilters.inStock"
          type="checkbox"
          class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <span class="ml-2 text-sm text-gray-700">In Stock Only</span>
      </label>
    </div>
  </div>
</template>
`;
  }

  protected generateSearchModal() {
    return `<script setup lang="ts">
import { useProduct } from '~/composables/useProduct'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { searchProducts, searchResults, loading } = useProduct()
const query = ref('')

const debouncedSearch = useDebounceFn(() => {
  if (query.value.length >= 2) {
    searchProducts(query.value)
  }
}, 300)

watch(query, debouncedSearch)

const handleClose = () => {
  query.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-50" @click="handleClose">
        <div
          class="max-w-2xl mx-auto mt-20 bg-white rounded-lg shadow-xl overflow-hidden"
          @click.stop
        >
          <div class="p-4 border-b">
            <input
              v-model="query"
              type="text"
              placeholder="Search products..."
              autofocus
              class="w-full text-lg outline-none"
            />
          </div>

          <div class="max-h-96 overflow-y-auto">
            <div v-if="loading" class="p-4 text-center text-gray-500">
              Searching...
            </div>

            <div v-else-if="query.length >= 2 && searchResults.length === 0" class="p-4 text-center text-gray-500">
              No products found
            </div>

            <div v-else-if="searchResults.length > 0">
              <NuxtLink
                v-for="product in searchResults"
                :key="product.id"
                :to="\`/product/\${product.slug}\`"
                @click="handleClose"
                class="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <NuxtImg
                  :src="product.images?.[0] || '/placeholder.jpg'"
                  :alt="product.name"
                  class="w-12 h-12 object-cover rounded"
                />
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium truncate">{{ product.name }}</h4>
                  <p class="text-sm text-gray-500">\${{ product.price.toFixed(2) }}</p>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
`;
  }

  protected generateHeader() {
    return `<script setup lang="ts">
import { useCart } from '~/composables/useCart'
import { useUser } from '~/composables/useUser'
import { useCategory } from '~/composables/useCategory'

const { cartCount } = useCart()
const { isAuthenticated } = useUser()
const { categories } = useCategory()

const isCartOpen = ref(false)
const isSearchOpen = ref(false)
const isMobileMenuOpen = ref(false)
</script>

<template>
  <header class="sticky top-0 z-30 bg-white border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="text-2xl font-bold text-primary-600">
          ${this.context.name}
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center space-x-8">
          <NuxtLink
            v-for="category in categories.slice(0, 4)"
            :key="category.id"
            :to="\`/category/\${category.slug}\`"
            class="text-gray-600 hover:text-primary-600 transition-colors"
          >
            {{ category.name }}
          </NuxtLink>
        </nav>

        <!-- Actions -->
        <div class="flex items-center space-x-4">
          <button
            @click="isSearchOpen = true"
            class="p-2 text-gray-600 hover:text-primary-600 transition-colors"
          >
            🔍
          </button>

          <NuxtLink
            :to="isAuthenticated ? '/account' : '/login'"
            class="p-2 text-gray-600 hover:text-primary-600 transition-colors"
          >
            👤
          </NuxtLink>

          <button
            @click="isCartOpen = true"
            class="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
          >
            🛒
            <span
              v-if="cartCount > 0"
              class="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center"
            >
              {{ cartCount > 9 ? '9+' : cartCount }}
            </span>
          </button>

          <!-- Mobile Menu Button -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden p-2 text-gray-600"
          >
            ☰
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    <Transition name="slide-down">
      <div v-if="isMobileMenuOpen" class="md:hidden border-t">
        <nav class="px-4 py-4 space-y-2">
          <NuxtLink
            v-for="category in categories"
            :key="category.id"
            :to="\`/category/\${category.slug}\`"
            @click="isMobileMenuOpen = false"
            class="block py-2 text-gray-600 hover:text-primary-600"
          >
            {{ category.name }}
          </NuxtLink>
        </nav>
      </div>
    </Transition>

    <!-- Cart Sidebar -->
    <CartSidebar :is-open="isCartOpen" @close="isCartOpen = false" />

    <!-- Search Modal -->
    <SearchModal :is-open="isSearchOpen" @close="isSearchOpen = false" />
  </header>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
`;
  }

  protected generateFooter() {
    return `<template>
  <footer class="bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- About -->
        <div>
          <h3 class="text-lg font-semibold mb-4">${this.context.name}</h3>
          <p class="text-gray-400 text-sm">
            Your one-stop shop for quality products at great prices.
            We're committed to providing the best shopping experience.
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Quick Links</h3>
          <ul class="space-y-2 text-sm">
            <li><NuxtLink to="/category/all" class="text-gray-400 hover:text-white transition-colors">Shop All</NuxtLink></li>
            <li><NuxtLink to="/about" class="text-gray-400 hover:text-white transition-colors">About Us</NuxtLink></li>
            <li><NuxtLink to="/contact" class="text-gray-400 hover:text-white transition-colors">Contact</NuxtLink></li>
            <li><NuxtLink to="/faq" class="text-gray-400 hover:text-white transition-colors">FAQ</NuxtLink></li>
          </ul>
        </div>

        <!-- Customer Service -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Customer Service</h3>
          <ul class="space-y-2 text-sm">
            <li><NuxtLink to="/shipping" class="text-gray-400 hover:text-white transition-colors">Shipping Info</NuxtLink></li>
            <li><NuxtLink to="/returns" class="text-gray-400 hover:text-white transition-colors">Returns & Exchanges</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="text-gray-400 hover:text-white transition-colors">Privacy Policy</NuxtLink></li>
            <li><NuxtLink to="/terms" class="text-gray-400 hover:text-white transition-colors">Terms of Service</NuxtLink></li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Contact Us</h3>
          <ul class="space-y-2 text-sm text-gray-400">
            <li>Email: support@${this.context.normalizedName}.com</li>
            <li>Phone: 1-800-SHOP-NOW</li>
            <li>Mon-Fri: 9am - 6pm EST</li>
          </ul>
        </div>
      </div>

      <div class="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
        <p>&copy; {{ new Date().getFullYear() }} ${this.context.name}. All rights reserved.</p>
        <p class="mt-2">Built with Vue Storefront</p>
      </div>
    </div>
  </footer>
</template>
`;
  }

  protected generateMiniCart() {
    return `<script setup lang="ts">
import { useCart } from '~/composables/useCart'

const { cartItems, cartTotal, cartCount } = useCart()
</script>

<template>
  <div class="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
    <div class="p-4">
      <h3 class="font-semibold mb-3">Cart ({{ cartCount }})</h3>

      <div v-if="cartCount === 0" class="text-center text-gray-500 py-4">
        Your cart is empty
      </div>

      <div v-else class="space-y-3 max-h-60 overflow-y-auto">
        <div
          v-for="item in cartItems.slice(0, 3)"
          :key="item.product.id"
          class="flex gap-3"
        >
          <NuxtImg
            :src="item.product.images?.[0] || '/placeholder.jpg'"
            :alt="item.product.name"
            class="w-12 h-12 object-cover rounded"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ item.product.name }}</p>
            <p class="text-sm text-gray-500">{{ item.quantity }} × \${{ item.product.price.toFixed(2) }}</p>
          </div>
        </div>

        <p v-if="cartItems.length > 3" class="text-sm text-gray-500 text-center">
          +{{ cartItems.length - 3 }} more items
        </p>
      </div>

      <div v-if="cartCount > 0" class="border-t mt-3 pt-3">
        <div class="flex justify-between font-semibold mb-3">
          <span>Subtotal</span>
          <span>\${{ cartTotal.toFixed(2) }}</span>
        </div>
        <NuxtLink
          to="/cart"
          class="block w-full text-center bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          View Cart & Checkout
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateCartComposable() {
    return `import type { Product, CartItem } from '~/types'
import { useCartStore } from '~/stores/cart'

export const useCart = () => {
  const store = useCartStore()

  const cartItems = computed(() => store.items)
  const cartTotal = computed(() => store.total)
  const cartCount = computed(() => store.count)

  const addToCart = (product: Product, quantity: number = 1, variant?: string | null) => {
    store.addItem(product, quantity, variant)
  }

  const removeFromCart = (productId: string) => {
    store.removeItem(productId)
  }

  const updateQuantity = (productId: string, quantity: number) => {
    store.updateQuantity(productId, quantity)
  }

  const clearCart = () => {
    store.clearCart()
  }

  return {
    cartItems,
    cartTotal,
    cartCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart
  }
}
`;
  }

  protected generateProductComposable() {
    return `import type { Product } from '~/types'

export const useProduct = () => {
  const products = ref<Product[]>([])
  const searchResults = ref<Product[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchProducts = async () => {
    loading.value = true
    try {
      const { data } = await useFetch<Product[]>('/api/products')
      products.value = data.value || []
    } catch (e) {
      error.value = 'Failed to fetch products'
    } finally {
      loading.value = false
    }
  }

  const getProductBySlug = (slug: string): Product | undefined => {
    return products.value.find(p => p.slug === slug)
  }

  const searchProducts = async (query: string) => {
    loading.value = true
    try {
      searchResults.value = products.value.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description?.toLowerCase().includes(query.toLowerCase())
      )
    } finally {
      loading.value = false
    }
  }

  // Auto-fetch on mount
  onMounted(() => {
    if (products.value.length === 0) {
      fetchProducts()
    }
  })

  return {
    products,
    searchResults,
    loading,
    error,
    fetchProducts,
    getProductBySlug,
    searchProducts
  }
}
`;
  }

  protected generateCategoryComposable() {
    return `import type { Category } from '~/types'

export const useCategory = () => {
  const categories = ref<Category[]>([
    { id: '1', name: 'Electronics', slug: 'electronics', image: '/categories/electronics.jpg' },
    { id: '2', name: 'Clothing', slug: 'clothing', image: '/categories/clothing.jpg' },
    { id: '3', name: 'Home & Garden', slug: 'home-garden', image: '/categories/home.jpg' },
    { id: '4', name: 'Sports', slug: 'sports', image: '/categories/sports.jpg' },
    { id: '5', name: 'Books', slug: 'books', image: '/categories/books.jpg' },
    { id: '6', name: 'Beauty', slug: 'beauty', image: '/categories/beauty.jpg' },
  ])

  const getCategoryBySlug = (slug: string): Category | undefined => {
    return categories.value.find(c => c.slug === slug)
  }

  return {
    categories,
    getCategoryBySlug
  }
}
`;
  }

  protected generateUserComposable() {
    return `import { useUserStore } from '~/stores/user'

export const useUser = () => {
  const store = useUserStore()

  const user = computed(() => store.user)
  const isAuthenticated = computed(() => store.isAuthenticated)
  const loading = ref(false)

  const login = async (email: string, password: string) => {
    loading.value = true
    try {
      // Implement actual login logic
      store.setUser({
        id: '1',
        email,
        firstName: 'John',
        lastName: 'Doe'
      })
      return true
    } catch (e) {
      return false
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    store.clearUser()
    navigateTo('/')
  }

  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    loading.value = true
    try {
      // Implement actual registration logic
      store.setUser({
        id: '1',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName
      })
      return true
    } catch (e) {
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    register
  }
}
`;
  }

  protected generateWishlistComposable() {
    return `import type { Product } from '~/types'
import { useWishlistStore } from '~/stores/wishlist'

export const useWishlist = () => {
  const store = useWishlistStore()

  const wishlistItems = computed(() => store.items)
  const wishlistCount = computed(() => store.count)

  const toggleWishlist = (product: Product) => {
    if (store.isInWishlist(product.id)) {
      store.removeItem(product.id)
    } else {
      store.addItem(product)
    }
  }

  const isInWishlist = (productId: string) => {
    return store.isInWishlist(productId)
  }

  const clearWishlist = () => {
    store.clearWishlist()
  }

  return {
    wishlistItems,
    wishlistCount,
    toggleWishlist,
    isInWishlist,
    clearWishlist
  }
}
`;
  }

  protected generateCheckoutComposable() {
    return `import type { CartItem } from '~/types'

interface CheckoutData {
  items: CartItem[]
  shippingAddress: any
  billingAddress: any
  paymentMethod: string
  shippingMethod: string
  total: number
}

export const useCheckout = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const processCheckout = async (data: CheckoutData) => {
    loading.value = true
    error.value = null

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Clear cart after successful checkout
      const { clearCart } = useCart()
      clearCart()

      // Navigate to success page
      navigateTo('/checkout/success')
    } catch (e: any) {
      error.value = e.message || 'Checkout failed. Please try again.'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    processCheckout
  }
}
`;
  }

  protected generateCartStore() {
    return `import { defineStore } from 'pinia'
import type { Product, CartItem } from '~/types'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[]
  }),

  getters: {
    count: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    total: (state) => state.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  },

  actions: {
    addItem(product: Product, quantity: number = 1, variant?: string | null) {
      const existingIndex = this.items.findIndex(
        item => item.product.id === product.id && item.variant === variant
      )

      if (existingIndex >= 0) {
        this.items[existingIndex].quantity += quantity
      } else {
        this.items.push({ product, quantity, variant: variant || undefined })
      }
    },

    removeItem(productId: string) {
      this.items = this.items.filter(item => item.product.id !== productId)
    },

    updateQuantity(productId: string, quantity: number) {
      const item = this.items.find(item => item.product.id === productId)
      if (item) {
        item.quantity = Math.max(1, quantity)
      }
    },

    clearCart() {
      this.items = []
    }
  },

  persist: true
})
`;
  }

  protected generateUserStore() {
    return `import { defineStore } from 'pinia'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    token: null as string | null
  }),

  getters: {
    isAuthenticated: (state) => !!state.user
  },

  actions: {
    setUser(user: User) {
      this.user = user
    },

    setToken(token: string) {
      this.token = token
    },

    clearUser() {
      this.user = null
      this.token = null
    }
  },

  persist: true
})
`;
  }

  protected generateWishlistStore() {
    return `import { defineStore } from 'pinia'
import type { Product } from '~/types'

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    items: [] as Product[]
  }),

  getters: {
    count: (state) => state.items.length,
    isInWishlist: (state) => (productId: string) =>
      state.items.some(item => item.id === productId)
  },

  actions: {
    addItem(product: Product) {
      if (!this.items.some(item => item.id === product.id)) {
        this.items.push(product)
      }
    },

    removeItem(productId: string) {
      this.items = this.items.filter(item => item.id !== productId)
    },

    clearWishlist() {
      this.items = []
    }
  },

  persist: true
})
`;
  }

  protected generateProductsApi() {
    return `import type { Product } from '~/types'

// Mock product data - replace with actual database/API calls
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Bluetooth Headphones',
    slug: 'wireless-bluetooth-headphones',
    description: 'Premium wireless headphones with noise cancellation and 30-hour battery life.',
    price: 149.99,
    originalPrice: 199.99,
    images: ['/products/headphones-1.jpg', '/products/headphones-2.jpg'],
    categorySlug: 'electronics',
    categoryName: 'Electronics',
    inStock: true,
    rating: 4.5,
    reviewCount: 128,
    variants: ['Black', 'White', 'Blue']
  },
  {
    id: '2',
    name: 'Smart Watch Pro',
    slug: 'smart-watch-pro',
    description: 'Advanced smartwatch with health monitoring and GPS tracking.',
    price: 299.99,
    images: ['/products/watch-1.jpg'],
    categorySlug: 'electronics',
    categoryName: 'Electronics',
    inStock: true,
    rating: 4.8,
    reviewCount: 256
  },
  {
    id: '3',
    name: 'Premium Cotton T-Shirt',
    slug: 'premium-cotton-tshirt',
    description: '100% organic cotton t-shirt with a comfortable fit.',
    price: 29.99,
    images: ['/products/tshirt-1.jpg'],
    categorySlug: 'clothing',
    categoryName: 'Clothing',
    inStock: true,
    rating: 4.2,
    reviewCount: 89,
    variants: ['S', 'M', 'L', 'XL']
  },
  {
    id: '4',
    name: 'Yoga Mat Premium',
    slug: 'yoga-mat-premium',
    description: 'Eco-friendly yoga mat with excellent grip and cushioning.',
    price: 49.99,
    images: ['/products/yoga-1.jpg'],
    categorySlug: 'sports',
    categoryName: 'Sports',
    inStock: true,
    rating: 4.6,
    reviewCount: 167
  }
]

export default defineEventHandler((event) => {
  const query = getQuery(event)

  let products = [...mockProducts]

  // Filter by category
  if (query.category && query.category !== 'all') {
    products = products.filter(p => p.categorySlug === query.category)
  }

  // Search filter
  if (query.search) {
    const searchTerm = String(query.search).toLowerCase()
    products = products.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm)
    )
  }

  return products
})
`;
  }

  protected generateProductDetailApi() {
    return `export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')

  // Mock product - replace with actual database call
  const product = {
    id: '1',
    name: 'Wireless Bluetooth Headphones',
    slug: 'wireless-bluetooth-headphones',
    description: 'Premium wireless headphones with active noise cancellation, delivering crystal-clear audio quality and up to 30 hours of battery life. Features include touch controls, voice assistant support, and comfortable over-ear design.',
    price: 149.99,
    originalPrice: 199.99,
    images: ['/products/headphones-1.jpg', '/products/headphones-2.jpg', '/products/headphones-3.jpg'],
    categorySlug: 'electronics',
    categoryName: 'Electronics',
    inStock: true,
    rating: 4.5,
    reviewCount: 128,
    variants: ['Black', 'White', 'Blue'],
    sku: 'WBH-001',
    brand: 'AudioPro',
    material: 'Premium Plastic, Memory Foam'
  }

  if (!product || product.slug !== slug) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found'
    })
  }

  return product
})
`;
  }

  protected generateCategoriesApi() {
    return `export default defineEventHandler(() => {
  return [
    { id: '1', name: 'Electronics', slug: 'electronics', image: '/categories/electronics.jpg' },
    { id: '2', name: 'Clothing', slug: 'clothing', image: '/categories/clothing.jpg' },
    { id: '3', name: 'Home & Garden', slug: 'home-garden', image: '/categories/home.jpg' },
    { id: '4', name: 'Sports', slug: 'sports', image: '/categories/sports.jpg' },
    { id: '5', name: 'Books', slug: 'books', image: '/categories/books.jpg' },
    { id: '6', name: 'Beauty', slug: 'beauty', image: '/categories/beauty.jpg' },
  ]
})
`;
  }

  protected generateCartApi() {
    return `export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    // Get cart items from session/database
    return { items: [], total: 0 }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    // Add item to cart
    return { success: true, message: 'Item added to cart' }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    // Update cart item
    return { success: true, message: 'Cart updated' }
  }

  if (method === 'DELETE') {
    const body = await readBody(event)
    // Remove item from cart
    return { success: true, message: 'Item removed' }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
`;
  }

  protected generateTypes() {
    return `export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  originalPrice?: number
  images: string[]
  categorySlug: string
  categoryName: string
  inStock: boolean
  rating?: number
  reviewCount?: number
  variants?: string[]
  sku?: string
  brand?: string
  material?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
}

export interface CartItem {
  product: Product
  quantity: number
  variant?: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  addresses?: Address[]
}

export interface Address {
  id: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  isDefault?: boolean
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  shippingAddress: Address
  billingAddress: Address
  paymentMethod: string
  shippingMethod: string
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
  updatedAt: string
}
`;
  }

  protected generateAuthMiddleware() {
    return `export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useUser()

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
`;
  }

  protected generateDefaultLayout() {
    return `<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
`;
  }

  protected generateCheckoutLayout() {
    return `<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="text-2xl font-bold text-primary-600">
          ${this.context.name}
        </NuxtLink>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
`;
  }

  protected generateCommercePlugin() {
    return `export default defineNuxtPlugin(() => {
  // Initialize commerce SDK or any third-party services
  const config = useRuntimeConfig()

  // Example: Initialize analytics, payment providers, etc.
  console.log('Commerce plugin initialized')

  return {
    provide: {
      commerce: {
        formatPrice: (price: number, currency: string = 'USD') => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
          }).format(price)
        },
        calculateDiscount: (original: number, sale: number) => {
          return Math.round((1 - sale / original) * 100)
        }
      }
    }
  }
})
`;
  }

  protected generateMainCss() {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base styles */
@layer base {
  body {
    @apply antialiased text-gray-900;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-semibold;
  }
}

/* Custom component styles */
@layer components {
  .btn-primary {
    @apply bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors;
  }

  .btn-secondary {
    @apply border border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors;
  }

  .input-field {
    @apply w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent;
  }

  .card {
    @apply bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow;
  }
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(2px);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Product image zoom effect */
.product-image-zoom {
  @apply overflow-hidden;
}

.product-image-zoom img {
  @apply transition-transform duration-300;
}

.product-image-zoom:hover img {
  transform: scale(1.05);
}

/* Line clamp utilities */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;
  }

  protected generateEnvExample() {
    return `# Application
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_API_URL=http://localhost:3000/api

# Stripe Payment
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Commerce API (if using external commerce platform)
COMMERCE_API_KEY=your_commerce_api_key
COMMERCE_API_URL=https://api.commerce-platform.com

# Features
NUXT_PUBLIC_I18N_LOCALE=en
NUXT_PUBLIC_GUEST_CHECKOUT=true
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description || 'A modern e-commerce store built with Vue Storefront and Nuxt 3.'}

## Features

- **Vue Storefront SDK**: Headless commerce solution
- **Nuxt 3**: Full-stack Vue framework with SSR/SSG
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **Pinia**: State management with persistence
- **Stripe Integration**: Payment processing
- **i18n**: Multi-language support
- **Image Optimization**: Via @nuxt/image

## E-commerce Features

- Product catalog with categories and filters
- Product detail pages with galleries
- Shopping cart with persistence
- Checkout flow with multiple payment options
- User accounts and order history
- Wishlist functionality
- Search functionality
- Responsive design

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm

### Installation

\`\`\`bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
\`\`\`

### Development

\`\`\`bash
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

\`\`\`bash
# Build for production
pnpm build

# Preview production build
pnpm preview

# Generate static site
pnpm generate
\`\`\`

## Project Structure

\`\`\`
app/
├── pages/                # File-based routing
│   ├── index.vue        # Home page
│   ├── category/        # Category pages
│   ├── product/         # Product pages
│   ├── cart.vue         # Cart page
│   ├── checkout.vue     # Checkout page
│   └── account/         # Account pages
├── components/          # Vue components
│   ├── ProductCard.vue
│   ├── CartSidebar.vue
│   └── ...
├── composables/         # Auto-imported composables
│   ├── useCart.ts
│   ├── useProduct.ts
│   └── ...
├── stores/              # Pinia stores
│   ├── cart.ts
│   ├── user.ts
│   └── wishlist.ts
├── server/api/          # API routes
├── types/               # TypeScript types
└── assets/css/          # Global styles
\`\`\`

## Customization

### Connecting to a Commerce Platform

This template includes mock data. To connect to a real commerce platform:

1. Install the appropriate VSF SDK integration
2. Update API routes in \`server/api/\`
3. Configure environment variables

### Payment Integration

Stripe is pre-configured. Update your keys in \`.env\`:

\`\`\`env
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
\`\`\`

### Styling

Customize the theme in \`tailwind.config.js\`:

\`\`\`js
theme: {
  extend: {
    colors: {
      primary: {
        // Your brand colors
      }
    }
  }
}
\`\`\`

## Docker

### Build and Run

\`\`\`bash
docker build -t ${this.context.normalizedName} .
docker run -p 3000:3000 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Testing

\`\`\`bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
\`\`\`

## Deployment

This application can be deployed to:

- **Vercel**: Zero-config deployment
- **Netlify**: With SSR support
- **AWS**: Lambda or EC2
- **Docker**: Any container platform

## Learn More

- [Vue Storefront Documentation](https://docs.vuestorefront.io/)
- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Vue Storefront

# Dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable pnpm && pnpm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxt

COPY --from=builder /app/package.json ./
COPY --from=builder /app/.output ./.output
COPY --from=builder --chown=nuxt:nodejs /app/node_modules ./node_modules

USER nuxt

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", ".output/server/index.mjs"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NUXT_PUBLIC_SITE_URL=http://localhost:3000
      - NUXT_PUBLIC_API_URL=http://localhost:3000/api
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Add Redis for session storage
  # redis:
  #   image: redis:alpine
  #   ports:
  #     - "6379:6379"
  #   volumes:
  #     - redis_data:/data

# volumes:
#   redis_data:
`;
  }
}
