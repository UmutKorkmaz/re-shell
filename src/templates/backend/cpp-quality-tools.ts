// No specific imports needed - using string for file content

export interface CppQualityToolsConfig {
  enableClangFormat: boolean;
  enableClangTidy: boolean;
  enableCppCheck: boolean;
  enableIncludeWhatYouUse: boolean;
  cppStandard: 'c++14' | 'c++17' | 'c++20' | 'c++23';
  framework: string;
}

export class CppQualityToolsGenerator {
  static generate(config: CppQualityToolsConfig): Record<string, string> {
    const files: Record<string, string> = {};

    // Clang-format configuration
    files['.clang-format'] = `# Clang-format configuration for ${config.framework} C++ project
# Based on Google C++ Style Guide with modifications

Language: Cpp
BasedOnStyle: Google

# Indentation
IndentWidth: 4
TabWidth: 4
UseTab: Never
IndentCaseLabels: true
IndentPPDirectives: BeforeHash
IndentExternBlock: Indent
IndentGotoLabels: true
IndentWrappedFunctionNames: false
NamespaceIndentation: None

# Alignment
AlignAfterOpenBracket: Align
AlignConsecutiveAssignments: false
AlignConsecutiveDeclarations: false
AlignConsecutiveMacros: true
AlignEscapedNewlines: Left
AlignOperands: true
AlignTrailingComments: true

# Allow short statements on single line
AllowAllParametersOfDeclarationOnNextLine: true
AllowShortBlocksOnASingleLine: Empty
AllowShortCaseLabelsOnASingleLine: false
AllowShortFunctionsOnASingleLine: Inline
AllowShortIfStatementsOnASingleLine: Never
AllowShortLambdasOnASingleLine: All
AllowShortLoopsOnASingleLine: false

# Break settings
AlwaysBreakAfterReturnType: None
AlwaysBreakBeforeMultilineStrings: true
AlwaysBreakTemplateDeclarations: Yes
BinPackArguments: true
BinPackParameters: true
BreakBeforeBinaryOperators: None
BreakBeforeBraces: Attach
BreakBeforeTernaryOperators: true
BreakConstructorInitializers: BeforeColon
BreakInheritanceList: BeforeColon
BreakStringLiterals: true

# Other formatting
ColumnLimit: 100
CommentPragmas: '^ IWYU pragma:'
CompactNamespaces: false
ConstructorInitializerAllOnOneLineOrOnePerLine: true
ConstructorInitializerIndentWidth: 4
ContinuationIndentWidth: 4
Cpp11BracedListStyle: true
DerivePointerAlignment: false
DisableFormat: false
FixNamespaceComments: true
IncludeBlocks: Regroup
IncludeCategories:
  # System headers
  - Regex: '^<[^/]+>$'
    Priority: 1
  # Boost headers
  - Regex: '^<boost/'
    Priority: 2
  # Framework headers
  - Regex: '^<(crow|drogon|pistache|httplib|beast)/'
    Priority: 3
  # Other third-party headers
  - Regex: '^<'
    Priority: 4
  # Project headers
  - Regex: '^"'
    Priority: 5

# Spacing
SpaceAfterCStyleCast: false
SpaceAfterLogicalNot: false
SpaceAfterTemplateKeyword: true
SpaceBeforeAssignmentOperators: true
SpaceBeforeCpp11BracedList: false
SpaceBeforeCtorInitializerColon: true
SpaceBeforeInheritanceColon: true
SpaceBeforeParens: ControlStatements
SpaceBeforeRangeBasedForLoopColon: true
SpaceInEmptyParentheses: false
SpacesBeforeTrailingComments: 2
SpacesInAngles: false
SpacesInCStyleCastParentheses: false
SpacesInContainerLiterals: false
SpacesInParentheses: false
SpacesInSquareBrackets: false

# C++ specific
Standard: ${config.cppStandard === 'c++23' ? 'c++20' : config.cppStandard}
AccessModifierOffset: -4
PointerAlignment: Left
ReferenceAlignment: Left
ReflowComments: true
SortIncludes: true
SortUsingDeclarations: true
`;

    // Clang-tidy configuration
    files['.clang-tidy'] = `# Clang-tidy configuration for ${config.framework} C++ project
# Comprehensive checks for modern C++ code quality

Checks: '
  -*,
  bugprone-*,
  cert-*,
  clang-analyzer-*,
  concurrency-*,
  cppcoreguidelines-*,
  google-*,
  hicpp-*,
  misc-*,
  modernize-*,
  performance-*,
  portability-*,
  readability-*,
  -google-readability-todo,
  -google-readability-braces-around-statements,
  -google-build-using-namespace,
  -cppcoreguidelines-pro-type-vararg,
  -cppcoreguidelines-avoid-magic-numbers,
  -cppcoreguidelines-pro-bounds-pointer-arithmetic,
  -modernize-use-trailing-return-type,
  -readability-magic-numbers,
  -hicpp-vararg,
  -cert-err58-cpp
'

WarningsAsErrors: '
  bugprone-use-after-move,
  bugprone-infinite-loop,
  cert-err34-c,
  cppcoreguidelines-interfaces-global-init,
  cppcoreguidelines-slicing,
  google-runtime-int,
  misc-throw-by-value-catch-by-reference,
  modernize-use-nullptr,
  performance-move-const-arg,
  readability-container-size-empty
'

HeaderFilterRegex: '.*\\.(h|hpp|hxx)$'

CheckOptions:
  - key: readability-identifier-naming.ClassCase
    value: CamelCase
  - key: readability-identifier-naming.StructCase
    value: CamelCase
  - key: readability-identifier-naming.FunctionCase
    value: camelCase
  - key: readability-identifier-naming.VariableCase
    value: lower_case
  - key: readability-identifier-naming.GlobalConstantCase
    value: UPPER_CASE
  - key: readability-identifier-naming.ParameterCase
    value: lower_case
  - key: readability-identifier-naming.MemberCase
    value: lower_case
  - key: readability-identifier-naming.PrivateMemberSuffix
    value: '_'
  - key: readability-identifier-naming.EnumCase
    value: CamelCase
  - key: readability-identifier-naming.EnumConstantCase
    value: UPPER_CASE
  - key: readability-identifier-naming.NamespaceCase
    value: lower_case
  - key: readability-identifier-naming.TemplateParameterCase
    value: CamelCase
  
  - key: modernize-use-override.IgnoreDestructors
    value: true
  - key: modernize-use-nullptr.NullMacros
    value: 'NULL'
  - key: modernize-loop-convert.MinConfidence
    value: reasonable
  - key: modernize-use-auto.MinTypeNameLength
    value: 5
  
  - key: performance-unnecessary-value-param.IncludeStyle
    value: google
  - key: performance-move-const-arg.CheckTriviallyCopyableMove
    value: false
  
  - key: cppcoreguidelines-explicit-virtual-functions.IgnoreDestructors
    value: true
  - key: cppcoreguidelines-non-private-member-variables-in-classes.IgnoreClassesWithAllMemberVariablesBeingPublic
    value: true
  
  - key: google-readability-namespace-comments.SpacesBeforeComments
    value: 2
  - key: google-readability-function-size.StatementThreshold
    value: 800
  
  - key: cert-oop54-cpp.WarnOnlyIfThisHasSuspiciousField
    value: true
  
  - key: misc-non-private-member-variables-in-classes.IgnoreClassesWithAllMemberVariablesBeingPublic
    value: true
`;

    // CppCheck configuration
    if (config.enableCppCheck) {
      files['cppcheck.cfg'] = `<?xml version="1.0"?>
<cppcheck>
    <!-- Project-specific suppressions -->
    <suppressions>
        <suppress>
            <id>missingInclude</id>
            <fileName>generated/*</fileName>
        </suppress>
        <suppress>
            <id>unusedFunction</id>
            <fileName>tests/*</fileName>
        </suppress>
    </suppressions>
    
    <!-- Include paths -->
    <includedir>
        <dir>include</dir>
        <dir>src</dir>
    </includedir>
    
    <!-- Libraries -->
    <library>boost</library>
    <library>std</library>
    <library>openssl</library>
    
    <!-- Defines -->
    <define>NDEBUG</define>
    <define>_GNU_SOURCE</define>
    
    <!-- Exclude paths -->
    <exclude>
        <path>build</path>
        <path>generated</path>
        <path>.git</path>
    </exclude>
    
    <!-- Enable all checks -->
    <enable>all</enable>
    
    <!-- Specific checks -->
    <check>
        <id>performance</id>
        <severity>warning</severity>
    </check>
    <check>
        <id>portability</id>
        <severity>warning</severity>
    </check>
    <check>
        <id>style</id>
        <severity>style</severity>
    </check>
</cppcheck>
`;
    }

    // Include-what-you-use mapping
    if (config.enableIncludeWhatYouUse) {
      files['iwyu.imp'] = `# Include-what-you-use mapping file
[
  # Standard library mappings
  { include: ["<bits/std_abs.h>", "private", "<cmath>", "public"] },
  { include: ["<bits/std_function.h>", "private", "<functional>", "public"] },
  { include: ["<bits/shared_ptr.h>", "private", "<memory>", "public"] },
  
  # Boost mappings
  { include: ["<boost/asio/ip/tcp.hpp>", "private", "<boost/asio.hpp>", "public"] },
  { include: ["<boost/beast/core/flat_buffer.hpp>", "private", "<boost/beast.hpp>", "public"] },
  { include: ["<boost/beast/http/message.hpp>", "private", "<boost/beast/http.hpp>", "public"] },
  
  # Framework-specific mappings
  ${config.framework === 'crow' ? `{ include: ["<crow/app.h>", "private", "<crow.h>", "public"] },` : ''}
  ${config.framework === 'drogon' ? `{ include: ["<drogon/HttpController.h>", "private", "<drogon/drogon.h>", "public"] },` : ''}
  ${config.framework === 'pistache' ? `{ include: ["<pistache/endpoint.h>", "private", "<pistache/pistache.h>", "public"] },` : ''}
  
  # Third-party library mappings
  { include: ["<nlohmann/detail/json_ref.hpp>", "private", "<nlohmann/json.hpp>", "public"] },
  { include: ["<spdlog/fmt/fmt.h>", "private", "<spdlog/spdlog.h>", "public"] },
  
  # Project-specific mappings
  { symbol: ["nullptr_t", "private", "<cstddef>", "public"] },
  { symbol: ["size_t", "private", "<cstddef>", "public"] },
  { symbol: ["std::string", "private", "<string>", "public"] },
  { symbol: ["std::vector", "private", "<vector>", "public"] }
]
`;
    }

    // CMake integration for quality tools
    files['cmake/CodeQuality.cmake'] = `# Code quality tools integration

# Find clang-format
find_program(CLANG_FORMAT_EXECUTABLE
    NAMES clang-format clang-format-15 clang-format-14 clang-format-13
    DOC "Path to clang-format executable"
)

# Find clang-tidy
find_program(CLANG_TIDY_EXECUTABLE
    NAMES clang-tidy clang-tidy-15 clang-tidy-14 clang-tidy-13
    DOC "Path to clang-tidy executable"
)

# Find cppcheck
find_program(CPPCHECK_EXECUTABLE
    NAMES cppcheck
    DOC "Path to cppcheck executable"
)

# Find include-what-you-use
find_program(IWYU_EXECUTABLE
    NAMES include-what-you-use iwyu
    DOC "Path to include-what-you-use executable"
)

# Function to add format target
function(add_format_target target)
    if(CLANG_FORMAT_EXECUTABLE)
        add_custom_target(format-\${target}
            COMMAND \${CLANG_FORMAT_EXECUTABLE}
            -i
            \${ARGN}
            WORKING_DIRECTORY \${CMAKE_CURRENT_SOURCE_DIR}
            COMMENT "Formatting \${target} with clang-format"
        )
        
        # Add to global format target
        if(NOT TARGET format)
            add_custom_target(format)
        endif()
        add_dependencies(format format-\${target})
    endif()
endfunction()

# Function to add tidy target
function(add_tidy_target target)
    if(CLANG_TIDY_EXECUTABLE)
        set_target_properties(\${target} PROPERTIES
            CXX_CLANG_TIDY "\${CLANG_TIDY_EXECUTABLE};-p=\${CMAKE_BINARY_DIR}"
        )
    endif()
endfunction()

# Function to add cppcheck target
function(add_cppcheck_target target)
    if(CPPCHECK_EXECUTABLE)
        add_custom_target(cppcheck-\${target}
            COMMAND \${CPPCHECK_EXECUTABLE}
            --enable=all
            --project=\${CMAKE_BINARY_DIR}/compile_commands.json
            --suppress-xml=\${CMAKE_SOURCE_DIR}/cppcheck.cfg
            --error-exitcode=1
            --inline-suppr
            WORKING_DIRECTORY \${CMAKE_SOURCE_DIR}
            COMMENT "Running cppcheck on \${target}"
        )
    endif()
endfunction()

# Function to add include-what-you-use
function(add_iwyu_target target)
    if(IWYU_EXECUTABLE)
        set_target_properties(\${target} PROPERTIES
            CXX_INCLUDE_WHAT_YOU_USE "\${IWYU_EXECUTABLE};-Xiwyu;--mapping_file=\${CMAKE_SOURCE_DIR}/iwyu.imp"
        )
    endif()
endfunction()

# Create global targets
if(CLANG_FORMAT_EXECUTABLE)
    # Find all source files
    file(GLOB_RECURSE ALL_SOURCE_FILES
        \${CMAKE_SOURCE_DIR}/src/*.cpp
        \${CMAKE_SOURCE_DIR}/src/*.hpp
        \${CMAKE_SOURCE_DIR}/include/*.hpp
        \${CMAKE_SOURCE_DIR}/tests/*.cpp
    )
    
    add_custom_target(format-all
        COMMAND \${CLANG_FORMAT_EXECUTABLE} -i \${ALL_SOURCE_FILES}
        WORKING_DIRECTORY \${CMAKE_SOURCE_DIR}
        COMMENT "Formatting all source files"
    )
    
    add_custom_target(format-check
        COMMAND \${CLANG_FORMAT_EXECUTABLE} --dry-run --Werror \${ALL_SOURCE_FILES}
        WORKING_DIRECTORY \${CMAKE_SOURCE_DIR}
        COMMENT "Checking source file formatting"
    )
endif()

if(CLANG_TIDY_EXECUTABLE)
    add_custom_target(tidy-all
        COMMAND \${CLANG_TIDY_EXECUTABLE}
        -p=\${CMAKE_BINARY_DIR}
        \${ALL_SOURCE_FILES}
        WORKING_DIRECTORY \${CMAKE_SOURCE_DIR}
        COMMENT "Running clang-tidy on all files"
    )
endif()

if(CPPCHECK_EXECUTABLE)
    add_custom_target(cppcheck-all
        COMMAND \${CPPCHECK_EXECUTABLE}
        --enable=all
        --project=\${CMAKE_BINARY_DIR}/compile_commands.json
        --suppress-xml=\${CMAKE_SOURCE_DIR}/cppcheck.cfg
        --error-exitcode=1
        WORKING_DIRECTORY \${CMAKE_SOURCE_DIR}
        COMMENT "Running cppcheck on all files"
    )
endif()

# Enable compile commands for tools
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Print tool availability
message(STATUS "Code Quality Tools:")
if(CLANG_FORMAT_EXECUTABLE)
    message(STATUS "  clang-format: \${CLANG_FORMAT_EXECUTABLE}")
else()
    message(STATUS "  clang-format: NOT FOUND")
endif()

if(CLANG_TIDY_EXECUTABLE)
    message(STATUS "  clang-tidy: \${CLANG_TIDY_EXECUTABLE}")
else()
    message(STATUS "  clang-tidy: NOT FOUND")
endif()

if(CPPCHECK_EXECUTABLE)
    message(STATUS "  cppcheck: \${CPPCHECK_EXECUTABLE}")
else()
    message(STATUS "  cppcheck: NOT FOUND")
endif()

if(IWYU_EXECUTABLE)
    message(STATUS "  include-what-you-use: \${IWYU_EXECUTABLE}")
else()
    message(STATUS "  include-what-you-use: NOT FOUND")
endif()
`;

    // Pre-commit hooks
    files['.pre-commit-config.yaml'] = `# Pre-commit hooks for C++ code quality
repos:
  - repo: local
    hooks:
      - id: clang-format
        name: clang-format
        entry: clang-format
        language: system
        files: '\\.(cpp|hpp|h|cc|cxx)$'
        args: ['-i']
        
      - id: clang-tidy
        name: clang-tidy
        entry: clang-tidy
        language: system
        files: '\\.(cpp|cc|cxx)$'
        args: ['-p=build']
        require_serial: true
        
      - id: cppcheck
        name: cppcheck
        entry: cppcheck
        language: system
        files: '\\.(cpp|hpp|h|cc|cxx)$'
        args: ['--enable=all', '--inline-suppr', '--error-exitcode=1']
        
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-merge-conflict
      
  - repo: https://github.com/psf/black
    rev: 24.1.1
    hooks:
      - id: black
        files: 'scripts/.*\\.py$'
        
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.9.0.6
    hooks:
      - id: shellcheck
        files: 'scripts/.*\\.sh$'
`;

    // Quality check script
    files['scripts/check-quality.sh'] = `#!/bin/bash

# Code quality check script
set -e

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\${BLUE}C++ Code Quality Checker\${NC}"
echo "========================"

FAILED=0

# Check if build directory exists
if [ ! -d "build" ]; then
    echo -e "\${YELLOW}Creating build directory...\${NC}"
    mkdir build
    cd build
    cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..
    cd ..
fi

# Run clang-format check
if command -v clang-format &> /dev/null; then
    echo -e "\\n\${BLUE}Running clang-format check...\${NC}"
    if find . -name "*.cpp" -o -name "*.hpp" -o -name "*.h" | \\
       grep -v build | grep -v generated | \\
       xargs clang-format --dry-run --Werror 2>/dev/null; then
        echo -e "\${GREEN}✓ Code formatting check passed\${NC}"
    else
        echo -e "\${RED}✗ Code formatting check failed\${NC}"
        echo "  Run 'make format-all' to fix formatting"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "\${YELLOW}clang-format not found, skipping format check\${NC}"
fi

# Run clang-tidy
if command -v clang-tidy &> /dev/null; then
    echo -e "\\n\${BLUE}Running clang-tidy...\${NC}"
    if find src include -name "*.cpp" | \\
       xargs clang-tidy -p=build --quiet 2>/dev/null; then
        echo -e "\${GREEN}✓ clang-tidy check passed\${NC}"
    else
        echo -e "\${RED}✗ clang-tidy check failed\${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "\${YELLOW}clang-tidy not found, skipping static analysis\${NC}"
fi

# Run cppcheck
if command -v cppcheck &> /dev/null; then
    echo -e "\\n\${BLUE}Running cppcheck...\${NC}"
    if cppcheck --enable=all --quiet --error-exitcode=1 \\
                --project=build/compile_commands.json \\
                --suppress-xml=cppcheck.cfg 2>/dev/null; then
        echo -e "\${GREEN}✓ cppcheck passed\${NC}"
    else
        echo -e "\${RED}✗ cppcheck failed\${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "\${YELLOW}cppcheck not found, skipping static analysis\${NC}"
fi

# Run include-what-you-use
if command -v include-what-you-use &> /dev/null; then
    echo -e "\\n\${BLUE}Running include-what-you-use...\${NC}"
    # Note: This is informational only, not failing the build
    find src include -name "*.cpp" | head -5 | \\
    while read file; do
        echo "Checking $file..."
        include-what-you-use -Xiwyu --mapping_file=iwyu.imp \\
                           -I include -std=${config.cppStandard} "$file" 2>&1 | \\
        grep -v "has correct #includes" || true
    done
fi

# Summary
echo -e "\\n\${BLUE}Summary\${NC}"
echo "======="
if [ $FAILED -eq 0 ]; then
    echo -e "\${GREEN}All quality checks passed!\${NC}"
    exit 0
else
    echo -e "\${RED}$FAILED quality checks failed\${NC}"
    exit 1
fi
`;

    // VS Code integration
    files['.vscode/settings.json'] = `{
    "C_Cpp.default.configurationProvider": "ms-vscode.cmake-tools",
    "C_Cpp.clang_format_path": "clang-format",
    "C_Cpp.clang_format_style": "file",
    "C_Cpp.clang_format_fallbackStyle": "Google",
    "editor.formatOnSave": true,
    "editor.formatOnType": true,
    "clang-tidy.executable": "clang-tidy",
    "clang-tidy.checks": [
        "bugprone-*",
        "cert-*",
        "cppcoreguidelines-*",
        "modernize-*",
        "performance-*",
        "readability-*"
    ],
    "files.associations": {
        "*.hpp": "cpp",
        "*.h": "cpp",
        "*.cpp": "cpp",
        "*.cc": "cpp",
        "*.cxx": "cpp"
    },
    "cmake.configureSettings": {
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
    }
}`;

    // Documentation
    files['docs/CODE_QUALITY.md'] = `# C++ Code Quality Guide

This project uses several tools to maintain high code quality standards.

## Tools Overview

### 1. Clang-Format
Automatic code formatting based on Google C++ Style Guide.

\`\`\`bash
# Format all files
make format-all

# Check formatting (CI)
make format-check

# Format specific file
clang-format -i src/main.cpp
\`\`\`

### 2. Clang-Tidy
Static analysis and modernization suggestions.

\`\`\`bash
# Run on all files
make tidy-all

# Run on specific file
clang-tidy -p build src/main.cpp
\`\`\`

### 3. CppCheck
Additional static analysis tool.

\`\`\`bash
# Run analysis
make cppcheck-all

# With specific checks
cppcheck --enable=performance src/
\`\`\`

### 4. Include-What-You-Use
Optimize header includes.

\`\`\`bash
# Build with IWYU
cmake -DCMAKE_CXX_INCLUDE_WHAT_YOU_USE=include-what-you-use ..
make

# Manual check
include-what-you-use -std=${config.cppStandard} src/main.cpp
\`\`\`

## Pre-commit Hooks

Install pre-commit hooks:

\`\`\`bash
pip install pre-commit
pre-commit install
\`\`\`

This will automatically run:
- clang-format
- clang-tidy
- cppcheck
- trailing whitespace removal

## IDE Integration

### VS Code
Settings are pre-configured in \`.vscode/settings.json\`.

Required extensions:
- C/C++ (ms-vscode.cpptools)
- Clang-Format (xaver.clang-format)
- C/C++ Clang-Tidy (notskm.clang-tidy)

### CLion
1. Settings → Editor → Code Style → C/C++
2. Import \`.clang-format\`
3. Enable ClangTidy: Settings → Editor → Inspections → C/C++ → General → Clang-Tidy

### Vim/Neovim
Add to config:
\`\`\`vim
" Format on save
autocmd BufWritePre *.cpp,*.hpp,*.h :ClangFormat

" Clang-tidy integration
let g:ale_linters = {'cpp': ['clangtidy']}
let g:ale_cpp_clangtidy_checks = ['*']
\`\`\`

## CI/CD Integration

Quality checks run automatically on:
- Every push
- Pull requests
- Nightly builds

Failed checks will block merging.

## Customization

### Disable specific checks

In code:
\`\`\`cpp
// NOLINTNEXTLINE(readability-magic-numbers)
const int magic = 42;

// NOLINT(readability-identifier-naming)
int badName = 0;
\`\`\`

In \`.clang-tidy\`:
Add to \`Checks\` with \`-\` prefix.

### Project-specific style

Modify:
- \`.clang-format\` for formatting
- \`.clang-tidy\` for checks
- \`cppcheck.cfg\` for cppcheck

## Best Practices

1. **Run checks locally** before pushing
2. **Fix warnings** don't suppress unless necessary
3. **Keep tools updated** for latest checks
4. **Document suppressions** with clear reasons
5. **Incremental adoption** for legacy code

## Troubleshooting

### Clang-format version mismatch
Use the same version as CI (usually latest stable).

### False positives
1. Verify it's actually false
2. Try updating the tool
3. Add targeted suppression with comment

### Performance impact
- Use ccache for faster rebuilds
- Run intensive checks in CI only
- Use incremental checking in IDE
`;

    return files;
  }
}

export function generateCppQualityToolsFiles(config: CppQualityToolsConfig): Record<string, string> {
  return CppQualityToolsGenerator.generate(config);
}