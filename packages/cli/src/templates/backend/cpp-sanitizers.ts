// No specific imports needed - using string for file content

export interface CppSanitizersConfig {
  enableAddressSanitizer: boolean;
  enableThreadSanitizer: boolean;
  enableUndefinedBehaviorSanitizer: boolean;
  enableMemorySanitizer: boolean;
  enableLeakSanitizer: boolean;
  enableValgrind: boolean;
  framework: string;
}

export class CppSanitizersGenerator {
  static generate(config: CppSanitizersConfig): Record<string, string> {
    const files: Record<string, string> = {};

    // CMake configuration for sanitizers
    files['cmake/Sanitizers.cmake'] = `# Sanitizers configuration for C++ projects

option(ENABLE_ASAN "Enable AddressSanitizer" ${config.enableAddressSanitizer ? 'ON' : 'OFF'})
option(ENABLE_TSAN "Enable ThreadSanitizer" ${config.enableThreadSanitizer ? 'ON' : 'OFF'})
option(ENABLE_UBSAN "Enable UndefinedBehaviorSanitizer" ${config.enableUndefinedBehaviorSanitizer ? 'ON' : 'OFF'})
option(ENABLE_MSAN "Enable MemorySanitizer" ${config.enableMemorySanitizer ? 'ON' : 'OFF'})
option(ENABLE_LSAN "Enable LeakSanitizer" ${config.enableLeakSanitizer ? 'ON' : 'OFF'})

# Function to enable sanitizers
function(enable_sanitizers target)
    if(ENABLE_ASAN)
        message(STATUS "AddressSanitizer enabled for \${target}")
        target_compile_options(\${target} PRIVATE -fsanitize=address -fno-omit-frame-pointer)
        target_link_options(\${target} PRIVATE -fsanitize=address)
        target_compile_definitions(\${target} PRIVATE ASAN_ENABLED)
    endif()

    if(ENABLE_TSAN)
        message(STATUS "ThreadSanitizer enabled for \${target}")
        target_compile_options(\${target} PRIVATE -fsanitize=thread)
        target_link_options(\${target} PRIVATE -fsanitize=thread)
        target_compile_definitions(\${target} PRIVATE TSAN_ENABLED)
    endif()

    if(ENABLE_UBSAN)
        message(STATUS "UndefinedBehaviorSanitizer enabled for \${target}")
        target_compile_options(\${target} PRIVATE -fsanitize=undefined)
        target_link_options(\${target} PRIVATE -fsanitize=undefined)
        target_compile_definitions(\${target} PRIVATE UBSAN_ENABLED)
    endif()

    if(ENABLE_MSAN)
        message(STATUS "MemorySanitizer enabled for \${target}")
        target_compile_options(\${target} PRIVATE -fsanitize=memory -fno-omit-frame-pointer)
        target_link_options(\${target} PRIVATE -fsanitize=memory)
        target_compile_definitions(\${target} PRIVATE MSAN_ENABLED)
    endif()

    if(ENABLE_LSAN)
        message(STATUS "LeakSanitizer enabled for \${target}")
        target_compile_options(\${target} PRIVATE -fsanitize=leak)
        target_link_options(\${target} PRIVATE -fsanitize=leak)
        target_compile_definitions(\${target} PRIVATE LSAN_ENABLED)
    endif()

    # Common flags for all sanitizers
    if(ENABLE_ASAN OR ENABLE_TSAN OR ENABLE_UBSAN OR ENABLE_MSAN OR ENABLE_LSAN)
        target_compile_options(\${target} PRIVATE -g -O1)
        
        # Set environment variables for better output
        set_property(TEST \${target} PROPERTY ENVIRONMENT
            "ASAN_OPTIONS=print_stats=1:check_initialization_order=1:strict_init_order=1:detect_stack_use_after_return=1"
            "UBSAN_OPTIONS=print_stacktrace=1"
            "TSAN_OPTIONS=second_deadlock_stack=1"
            "LSAN_OPTIONS=suppressions=\${CMAKE_SOURCE_DIR}/lsan.supp"
        )
    endif()
endfunction()

# Sanitizer presets
function(enable_debug_sanitizers target)
    set(ENABLE_ASAN ON)
    set(ENABLE_UBSAN ON)
    set(ENABLE_LSAN ON)
    enable_sanitizers(\${target})
endfunction()

function(enable_thread_sanitizers target)
    set(ENABLE_TSAN ON)
    enable_sanitizers(\${target})
endfunction()

function(enable_memory_sanitizers target)
    set(ENABLE_MSAN ON)
    enable_sanitizers(\${target})
endfunction()

# Check for sanitizer support
include(CheckCXXCompilerFlag)
check_cxx_compiler_flag("-fsanitize=address" COMPILER_SUPPORTS_ASAN)
check_cxx_compiler_flag("-fsanitize=thread" COMPILER_SUPPORTS_TSAN)
check_cxx_compiler_flag("-fsanitize=undefined" COMPILER_SUPPORTS_UBSAN)
check_cxx_compiler_flag("-fsanitize=memory" COMPILER_SUPPORTS_MSAN)
check_cxx_compiler_flag("-fsanitize=leak" COMPILER_SUPPORTS_LSAN)

if(ENABLE_ASAN AND NOT COMPILER_SUPPORTS_ASAN)
    message(WARNING "AddressSanitizer requested but not supported by compiler")
    set(ENABLE_ASAN OFF)
endif()

if(ENABLE_TSAN AND NOT COMPILER_SUPPORTS_TSAN)
    message(WARNING "ThreadSanitizer requested but not supported by compiler")
    set(ENABLE_TSAN OFF)
endif()

# Conflict detection
if(ENABLE_ASAN AND ENABLE_TSAN)
    message(FATAL_ERROR "AddressSanitizer and ThreadSanitizer cannot be used together")
endif()

if(ENABLE_ASAN AND ENABLE_MSAN)
    message(FATAL_ERROR "AddressSanitizer and MemorySanitizer cannot be used together")
endif()

if(ENABLE_TSAN AND ENABLE_MSAN)
    message(FATAL_ERROR "ThreadSanitizer and MemorySanitizer cannot be used together")
endif()
`;

    // Valgrind suppression file
    files['valgrind.supp'] = `# Valgrind suppression file for ${config.framework}

# Suppress known false positives in system libraries
{
   glibc_dlopen_leak
   Memcheck:Leak
   fun:malloc
   ...
   fun:dlopen
}

{
   openssl_crypto_leak
   Memcheck:Leak
   fun:malloc
   ...
   obj:*/libcrypto.so*
}

{
   boost_test_leak
   Memcheck:Leak
   fun:_Znwm
   ...
   fun:_ZN5boost9unit_test*
}

# Suppress known issues in third-party libraries
{
   nlohmann_json_parse
   Memcheck:Cond
   fun:_ZN8nlohmann*json*parse*
}

# Add framework-specific suppressions
${config.framework === 'beast' ? `{
   boost_asio_reactor
   Memcheck:Leak
   fun:_Znwm
   ...
   fun:_ZN5boost4asio*reactor*
}` : ''}

${config.framework === 'drogon' ? `{
   drogon_http_parser
   Memcheck:Leak
   fun:malloc
   ...
   fun:_ZN6drogon*HttpRequest*
}` : ''}
`;

    // LeakSanitizer suppression file
    files['lsan.supp'] = `# LeakSanitizer suppression file

# Suppress one-time initialization leaks
leak:_dl_init
leak:__static_initialization_and_destruction

# Suppress known false positives in system libraries
leak:libcrypto.so
leak:libssl.so

# Boost related suppressions
leak:boost::system::error_category
leak:boost::asio::detail::

# Framework-specific suppressions
${config.framework === 'pistache' ? 'leak:Pistache::Http::Handler' : ''}
${config.framework === 'crow' ? 'leak:crow::SimpleApp' : ''}
`;

    // Memory debugging header
    files['include/debug/memory_debug.hpp'] = `#pragma once

#include <cstdlib>
#include <cstdio>
#include <memory>
#include <atomic>
#include <map>
#include <mutex>
#include <spdlog/spdlog.h>

namespace debug {

// Memory allocation tracker
class MemoryTracker {
public:
    static MemoryTracker& instance() {
        static MemoryTracker tracker;
        return tracker;
    }

    void recordAllocation(void* ptr, size_t size, const char* file, int line) {
        std::lock_guard<std::mutex> lock(mutex_);
        allocations_[ptr] = {size, file, line};
        total_allocated_ += size;
        peak_allocated_ = std::max(peak_allocated_.load(), total_allocated_.load());
    }

    void recordDeallocation(void* ptr) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = allocations_.find(ptr);
        if (it != allocations_.end()) {
            total_allocated_ -= it->second.size;
            allocations_.erase(it);
        }
    }

    void reportLeaks() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!allocations_.empty()) {
            spdlog::error("Memory leaks detected: {} allocations not freed", allocations_.size());
            for (const auto& [ptr, info] : allocations_) {
                spdlog::error("  Leak: {} bytes at {} ({}:{})", 
                             info.size, ptr, info.file, info.line);
            }
        }
        spdlog::info("Peak memory usage: {} bytes", peak_allocated_.load());
    }

    size_t getCurrentUsage() const { return total_allocated_; }
    size_t getPeakUsage() const { return peak_allocated_; }

private:
    struct AllocationInfo {
        size_t size;
        const char* file;
        int line;
    };

    std::mutex mutex_;
    std::map<void*, AllocationInfo> allocations_;
    std::atomic<size_t> total_allocated_{0};
    std::atomic<size_t> peak_allocated_{0};
};

// RAII memory leak detector
class MemoryLeakDetector {
public:
    MemoryLeakDetector() {
        spdlog::info("Memory leak detection enabled");
    }
    
    ~MemoryLeakDetector() {
        MemoryTracker::instance().reportLeaks();
    }
};

// Custom allocator for tracking
template<typename T>
class TrackingAllocator {
public:
    using value_type = T;

    TrackingAllocator() = default;
    
    template<typename U>
    TrackingAllocator(const TrackingAllocator<U>&) {}

    T* allocate(size_t n) {
        size_t size = n * sizeof(T);
        void* ptr = std::malloc(size);
        if (!ptr) throw std::bad_alloc();
        MemoryTracker::instance().recordAllocation(ptr, size, __FILE__, __LINE__);
        return static_cast<T*>(ptr);
    }

    void deallocate(T* ptr, size_t) {
        MemoryTracker::instance().recordDeallocation(ptr);
        std::free(ptr);
    }
};

// Sanitizer-aware smart pointer
template<typename T>
class SanitizerAwarePtr {
public:
    explicit SanitizerAwarePtr(T* ptr = nullptr) : ptr_(ptr) {
#ifdef ASAN_ENABLED
        if (ptr_) {
            __asan_poison_memory_region(ptr_, sizeof(T));
        }
#endif
    }

    ~SanitizerAwarePtr() {
#ifdef ASAN_ENABLED
        if (ptr_) {
            __asan_unpoison_memory_region(ptr_, sizeof(T));
        }
#endif
        delete ptr_;
    }

    T* operator->() {
#ifdef ASAN_ENABLED
        if (ptr_) {
            __asan_unpoison_memory_region(ptr_, sizeof(T));
        }
#endif
        return ptr_;
    }

    const T* operator->() const {
#ifdef ASAN_ENABLED
        if (ptr_) {
            __asan_unpoison_memory_region(ptr_, sizeof(T));
        }
#endif
        return ptr_;
    }

private:
    T* ptr_;
};

// Macros for memory debugging
#ifdef DEBUG_MEMORY
    #define TRACK_ALLOCATION(ptr, size) \\
        debug::MemoryTracker::instance().recordAllocation(ptr, size, __FILE__, __LINE__)
    #define TRACK_DEALLOCATION(ptr) \\
        debug::MemoryTracker::instance().recordDeallocation(ptr)
#else
    #define TRACK_ALLOCATION(ptr, size)
    #define TRACK_DEALLOCATION(ptr)
#endif

// AddressSanitizer annotations
#ifdef __has_feature
  #if __has_feature(address_sanitizer)
    #define ASAN_ENABLED
  #endif
#endif

#ifdef __SANITIZE_ADDRESS__
  #define ASAN_ENABLED
#endif

#ifdef ASAN_ENABLED
    #include <sanitizer/asan_interface.h>
    #define ASAN_POISON_MEMORY(ptr, size) __asan_poison_memory_region(ptr, size)
    #define ASAN_UNPOISON_MEMORY(ptr, size) __asan_unpoison_memory_region(ptr, size)
#else
    #define ASAN_POISON_MEMORY(ptr, size)
    #define ASAN_UNPOISON_MEMORY(ptr, size)
#endif

} // namespace debug
`;

    // Sanitizer test runner script
    files['scripts/run-sanitizers.sh'] = `#!/bin/bash

# Sanitizer test runner for C++ projects
set -e

BINARY="./build/{{serviceName}}"
TEST_BINARY="./build/tests"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\${BLUE}C++ Sanitizer Test Runner\${NC}"
echo "========================="

# Function to run with sanitizer
run_with_sanitizer() {
    local sanitizer=$1
    local binary=$2
    local name=$3
    
    echo -e "\\n\${YELLOW}Running \${name} with \${sanitizer}...\${NC}"
    
    case $sanitizer in
        "asan")
            export ASAN_OPTIONS="print_stats=1:check_initialization_order=1:strict_init_order=1:detect_stack_use_after_return=1:print_legend=1:print_scariness=1"
            export ASAN_SYMBOLIZER_PATH=$(which llvm-symbolizer)
            ;;
        "tsan")
            export TSAN_OPTIONS="halt_on_error=0:history_size=7:second_deadlock_stack=1"
            ;;
        "ubsan")
            export UBSAN_OPTIONS="print_stacktrace=1:halt_on_error=0"
            ;;
        "msan")
            export MSAN_OPTIONS="poison_in_dtor=1"
            ;;
        "lsan")
            export LSAN_OPTIONS="suppressions=lsan.supp:print_suppressions=0"
            ;;
    esac
    
    if $binary; then
        echo -e "\${GREEN}✓ \${name} passed \${sanitizer}\${NC}"
    else
        echo -e "\${RED}✗ \${name} failed \${sanitizer}\${NC}"
        return 1
    fi
}

# Build with different sanitizers
build_with_sanitizer() {
    local sanitizer=$1
    
    echo -e "\\n\${BLUE}Building with \${sanitizer}...\${NC}"
    
    mkdir -p build_\${sanitizer}
    cd build_\${sanitizer}
    
    case $sanitizer in
        "asan")
            cmake .. -DENABLE_ASAN=ON -DCMAKE_BUILD_TYPE=Debug
            ;;
        "tsan")
            cmake .. -DENABLE_TSAN=ON -DCMAKE_BUILD_TYPE=Debug
            ;;
        "ubsan")
            cmake .. -DENABLE_UBSAN=ON -DCMAKE_BUILD_TYPE=Debug
            ;;
        "msan")
            cmake .. -DENABLE_MSAN=ON -DCMAKE_BUILD_TYPE=Debug
            ;;
        "lsan")
            cmake .. -DENABLE_LSAN=ON -DCMAKE_BUILD_TYPE=Debug
            ;;
    esac
    
    make -j$(nproc)
    cd ..
}

# Run Valgrind tests
run_valgrind() {
    echo -e "\\n\${YELLOW}Running Valgrind memory check...\${NC}"
    
    valgrind --leak-check=full \\
             --show-leak-kinds=all \\
             --track-origins=yes \\
             --suppressions=valgrind.supp \\
             --gen-suppressions=all \\
             --error-exitcode=1 \\
             $TEST_BINARY
    
    if [ $? -eq 0 ]; then
        echo -e "\${GREEN}✓ Valgrind memory check passed\${NC}"
    else
        echo -e "\${RED}✗ Valgrind memory check failed\${NC}"
        return 1
    fi
}

# Main execution
SANITIZERS=("asan" "ubsan" "tsan")
FAILED=0

# Build and test with each sanitizer
for sanitizer in "\${SANITIZERS[@]}"; do
    if build_with_sanitizer $sanitizer; then
        if ! run_with_sanitizer $sanitizer "./build_\${sanitizer}/tests" "Unit tests"; then
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "\${RED}Failed to build with \${sanitizer}\${NC}"
        FAILED=$((FAILED + 1))
    fi
done

# Run Valgrind if available
if command -v valgrind &> /dev/null; then
    if ! run_valgrind; then
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "\${YELLOW}Valgrind not found, skipping memory check\${NC}"
fi

# Summary
echo -e "\\n\${BLUE}Summary\${NC}"
echo "======="
if [ $FAILED -eq 0 ]; then
    echo -e "\${GREEN}All sanitizer tests passed!\${NC}"
    exit 0
else
    echo -e "\${RED}$FAILED sanitizer tests failed\${NC}"
    exit 1
fi
`;

    // GitHub Actions workflow for sanitizers
    files['.github/workflows/sanitizers.yml'] = `name: Sanitizer Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  sanitizers:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        sanitizer: [asan, tsan, ubsan, msan]
        
    steps:
    - uses: actions/checkout@v4
    
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \\
          build-essential \\
          cmake \\
          clang-15 \\
          libboost-all-dev \\
          libssl-dev \\
          valgrind
    
    - name: Configure with \${{ matrix.sanitizer }}
      run: |
        mkdir build
        cd build
        cmake .. \\
          -DCMAKE_C_COMPILER=clang-15 \\
          -DCMAKE_CXX_COMPILER=clang++-15 \\
          -DCMAKE_BUILD_TYPE=Debug \\
          -DENABLE_\${{ matrix.sanitizer | upper }}=ON
    
    - name: Build
      run: cmake --build build -j$(nproc)
    
    - name: Run tests with \${{ matrix.sanitizer }}
      run: |
        cd build
        ctest --output-on-failure
      env:
        ASAN_OPTIONS: detect_leaks=1:strict_string_checks=1:detect_stack_use_after_return=1:check_initialization_order=1:strict_init_order=1
        TSAN_OPTIONS: halt_on_error=0:history_size=7
        UBSAN_OPTIONS: print_stacktrace=1:halt_on_error=0
        MSAN_OPTIONS: poison_in_dtor=1
        
  valgrind:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \\
          build-essential \\
          cmake \\
          libboost-all-dev \\
          libssl-dev \\
          valgrind
    
    - name: Configure
      run: |
        mkdir build
        cd build
        cmake .. -DCMAKE_BUILD_TYPE=Debug
    
    - name: Build
      run: cmake --build build -j$(nproc)
    
    - name: Run Valgrind
      run: |
        cd build
        valgrind \\
          --leak-check=full \\
          --show-leak-kinds=all \\
          --track-origins=yes \\
          --suppressions=../valgrind.supp \\
          --error-exitcode=1 \\
          ./tests
`;

    // Usage documentation
    files['docs/SANITIZERS.md'] = `# C++ Sanitizers and Memory Debugging

This project includes comprehensive support for various sanitizers and memory debugging tools.

## Available Sanitizers

### AddressSanitizer (ASan)
Detects:
- Use after free
- Heap buffer overflow
- Stack buffer overflow
- Global buffer overflow
- Use after return
- Use after scope
- Memory leaks

\`\`\`bash
cmake -DENABLE_ASAN=ON ..
make
./your_app
\`\`\`

### ThreadSanitizer (TSan)
Detects:
- Data races
- Deadlocks
- Thread leaks
- Mutex errors

\`\`\`bash
cmake -DENABLE_TSAN=ON ..
make
./your_app
\`\`\`

### UndefinedBehaviorSanitizer (UBSan)
Detects:
- Integer overflow
- Null pointer dereference
- Type confusion
- Undefined behavior

\`\`\`bash
cmake -DENABLE_UBSAN=ON ..
make
./your_app
\`\`\`

### MemorySanitizer (MSan)
Detects:
- Uninitialized memory reads

\`\`\`bash
cmake -DENABLE_MSAN=ON ..
make
./your_app
\`\`\`

### LeakSanitizer (LSan)
Detects:
- Memory leaks (standalone)

\`\`\`bash
cmake -DENABLE_LSAN=ON ..
make
./your_app
\`\`\`

## Valgrind Support

Run comprehensive memory analysis:

\`\`\`bash
valgrind --leak-check=full --show-leak-kinds=all ./your_app
\`\`\`

With suppressions:

\`\`\`bash
valgrind --suppressions=valgrind.supp ./your_app
\`\`\`

## Custom Memory Debugging

Enable custom memory tracking:

\`\`\`cpp
#include "debug/memory_debug.hpp"

int main() {
    debug::MemoryLeakDetector detector;
    
    // Your code here
    
    return 0;
}
\`\`\`

## Running All Sanitizers

Use the provided script:

\`\`\`bash
chmod +x scripts/run-sanitizers.sh
./scripts/run-sanitizers.sh
\`\`\`

## CI/CD Integration

Sanitizers are automatically run in CI:
- Every push to main/develop
- Every pull request
- Matrix testing with all sanitizers

## Best Practices

1. **Development**: Use ASan + UBSan
2. **Multithreaded code**: Use TSan
3. **Release candidates**: Run full sanitizer suite
4. **Production builds**: Disable all sanitizers

## Troubleshooting

### False Positives
Add suppressions to:
- \`lsan.supp\` for LeakSanitizer
- \`valgrind.supp\` for Valgrind

### Performance Impact
- ASan: 2x slowdown, 3x memory
- TSan: 5-15x slowdown, 5-10x memory
- MSan: 3x slowdown
- UBSan: Minimal impact

### Incompatibilities
- ASan + TSan cannot be used together
- ASan + MSan cannot be used together
- TSan + MSan cannot be used together
`;

    return files;
  }
}

export function generateCppSanitizersFiles(config: CppSanitizersConfig): Record<string, string> {
  return CppSanitizersGenerator.generate(config);
}