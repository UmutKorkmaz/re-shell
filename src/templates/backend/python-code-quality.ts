import { FileTemplate } from '../types';

interface CodeQualityConfig {
  framework: string;
  enableStrict?: boolean;
  enableAutofix?: boolean;
  enablePreCommit?: boolean;
  enableVSCode?: boolean;
  pythonVersion?: string;
}

export class PythonCodeQualityGenerator {
  generateCodeQualityConfig(config: CodeQualityConfig): FileTemplate[] {
    const templates: FileTemplate[] = [];

    // Black configuration
    templates.push({
      path: 'pyproject.toml',
      content: this.generatePyprojectToml(config)
    });

    // isort configuration
    templates.push({
      path: '.isort.cfg',
      content: this.generateIsortConfig(config)
    });

    // mypy configuration
    templates.push({
      path: 'mypy.ini',
      content: this.generateMypyConfig(config)
    });

    // Ruff configuration (modern alternative to flake8)
    templates.push({
      path: 'ruff.toml',
      content: this.generateRuffConfig(config)
    });

    // Pre-commit hooks
    if (config.enablePreCommit) {
      templates.push({
        path: '.pre-commit-config.yaml',
        content: this.generatePreCommitConfig(config)
      });
    }

    // VS Code settings
    if (config.enableVSCode) {
      templates.push({
        path: '.vscode/settings.json',
        content: this.generateVSCodeSettings(config)
      });
    }

    // Makefile for quality commands
    templates.push({
      path: 'Makefile.quality',
      content: this.generateQualityMakefile(config)
    });

    // Quality check script
    templates.push({
      path: 'scripts/quality_check.py',
      content: this.generateQualityCheckScript(config)
    });

    return templates;
  }

  protected generatePyprojectToml(config: CodeQualityConfig): string {
    const pythonVersion = config.pythonVersion || '3.11';
    
    return `[tool.black]
line-length = 88
target-version = ['py${pythonVersion.replace('.', '')}']
include = '\\.pyi?$'
extend-exclude = '''
/(
  # Directories
  \\.eggs
  | \\.git
  | \\.hg
  | \\.mypy_cache
  | \\.tox
  | \\.venv
  | _build
  | buck-out
  | build
  | dist
  | migrations
  | node_modules
  | venv
)/
'''

[tool.isort]
profile = "black"
multi_line_output = 3
include_trailing_comma = true
force_grid_wrap = 0
use_parentheses = true
ensure_newline_before_comments = true
line_length = 88
skip_gitignore = true
skip = ["migrations", "venv", ".venv", "node_modules"]

[tool.mypy]
python_version = "${pythonVersion}"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = ${config.enableStrict ? 'true' : 'false'}
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = ${config.enableStrict ? 'true' : 'false'}
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
warn_unreachable = true
strict_equality = true
strict_concatenate = true
ignore_missing_imports = true${config.enableStrict ? '\ndisallow_any_unimported = true' : ''}
pretty = true
show_column_numbers = true
show_error_codes = true
show_error_context = true

# Framework-specific settings
${this.getFrameworkMypySettings(config.framework)}

[tool.coverage.run]
source = ["."]
omit = ["*/tests/*", "*/test_*", "*/__pycache__/*", "*/venv/*", "*/.venv/*", "*/site-packages/*", "*/migrations/*"]

[tool.coverage.report]
precision = 2
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
    "if typing.TYPE_CHECKING:",
    "@abstractmethod",
    "@abc.abstractmethod"]

[tool.pytest.ini_options]
minversion = "6.0"
addopts = "-ra -q --strict-markers"
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]

[tool.ruff]
target-version = "py${pythonVersion.replace('.', '')}"
line-length = 88
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "C",    # flake8-comprehensions
    "B",    # flake8-bugbear
    "UP",   # pyupgrade
    "SIM",  # flake8-simplify
    "TCH",  # flake8-type-checking
    "RUF",  # Ruff-specific rules
]
ignore = [
    "E501",  # line too long (handled by black)
    "B008",  # do not perform function calls in argument defaults
    "C901",  # too complex
]

[tool.ruff.per-file-ignores]
"__init__.py" = ["F401"]
"migrations/*" = ["E501"]
"tests/*" = ["S101", "S105", "S106"]

[tool.ruff.isort]
known-third-party = [${this.getFrameworkImports(config.framework)}]

[tool.bandit]
exclude_dirs = ["tests", "venv", ".venv", "migrations"]
skips = ["B101", "B601"]

[tool.pylint.messages_control]
disable = [
    "C0111",  # missing-docstring
    "C0103",  # invalid-name
    "R0903",  # too-few-public-methods
    "R0913",  # too-many-arguments
    "W0622",  # redefined-builtin
]

[tool.pylint.format]
max-line-length = 88

[tool.poetry.dependencies]
python = "^${pythonVersion}"
black = "^23.0.0"
isort = "^5.12.0"
mypy = "^1.5.0"
ruff = "^0.1.0"
pre-commit = "^3.4.0"
bandit = "^1.7.5"
pylint = "^3.0.0"
pyupgrade = "^3.10.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
`;
  }

  protected generateIsortConfig(config: CodeQualityConfig): string {
    return `[settings]
profile = black
multi_line_output = 3
include_trailing_comma = True
force_grid_wrap = 0
use_parentheses = True
ensure_newline_before_comments = True
line_length = 88
skip_gitignore = True
skip = migrations,venv,.venv,node_modules
known_framework = ${this.getFrameworkModules(config.framework)}
known_third_party = pydantic,redis,celery,pytest,requests
known_first_party = app,src,core,api,models,services,utils
sections = FUTURE,STDLIB,FRAMEWORK,THIRDPARTY,FIRSTPARTY,LOCALFOLDER
`;
  }

  protected generateMypyConfig(config: CodeQualityConfig): string {
    return `[mypy]
python_version = ${config.pythonVersion || '3.11'}
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = ${config.enableStrict ? 'True' : 'False'}
disallow_incomplete_defs = True
check_untyped_defs = True
disallow_untyped_decorators = ${config.enableStrict ? 'True' : 'False'}
no_implicit_optional = True
warn_redundant_casts = True
warn_unused_ignores = True
warn_no_return = True
warn_unreachable = True
strict_equality = True
strict_concatenate = True
ignore_missing_imports = True${config.enableStrict ? '\ndisallow_any_unimported = True\ndisallow_untyped_calls = True' : ''}
pretty = True
show_column_numbers = True
show_error_codes = True
show_error_context = True
error_summary = True
exclude = ^(tests/|migrations/|venv/|.venv/)

# Plugin configuration
plugins = ${this.getFrameworkMypyPlugins(config.framework)}

# Per-module options
[mypy-tests.*]
disallow_untyped_defs = False
disallow_incomplete_defs = False

[mypy-migrations.*]
ignore_errors = True

[mypy-*.migrations.*]
ignore_errors = True

${this.getFrameworkMypyModules(config.framework)}${config.framework === 'django' ? '\n\n[mypy.plugins.django-stubs]\ndjango_settings_module = "settings"' : ''}
`;
  }

  protected generateRuffConfig(config: CodeQualityConfig): string {
    return `# Ruff configuration file
target-version = "py${(config.pythonVersion || '3.11').replace('.', '')}"
line-length = 88
indent-width = 4

[lint]
select = [
    "E",  # pycodestyle errors
    "W",  # pycodestyle warnings
    "F",  # pyflakes
    "I",  # isort
    "C",  # flake8-comprehensions
    "B",  # flake8-bugbear
    "UP",   # pyupgrade
    "SIM",  # flake8-simplify
    "TCH",  # flake8-type-checking
    "RUF",  # Ruff-specific rules
    "PTH",  # flake8-use-pathlib
    "ERA",  # eradicate
    "PL",   # pylint
    "TRY",  # tryceratops
    "FLY",  # flynt
    "PERF", # perflint
    "LOG",  # flake8-logging
    "A",    # flake8-builtins
    "COM",  # flake8-commas
    "C4",   # flake8-comprehensions
    "DTZ",  # flake8-datetimez
    "ISC",  # flake8-implicit-str-concat
    "ICN",  # flake8-import-conventions
    "G",    # flake8-logging-format
    "INP",  # flake8-no-pep420
    "PIE",  # flake8-pie
    "PT",   # flake8-pytest-style
    "RET",  # flake8-return
    "SIM",  # flake8-simplify
    "TID",  # flake8-tidy-imports
    "ARG",  # flake8-unused-arguments
    "PGH",  # pygrep-hooks
    "FBT",  # flake8-boolean-trap
    "RSE",  # flake8-raise
    "SLF",  # flake8-self
]

ignore = [
    "E501",   # line too long (handled by black)
    "B008",   # do not perform function calls in argument defaults
    "C901",   # too complex
    "PLR",    # pylint refactor
    "FBT001", # boolean trap
    "FBT002", # boolean default
]

# Allow autofix for all enabled rules${config.enableAutofix ? '\nfixable = ["ALL"]\nunfixable = []' : ''}

# Exclude a variety of commonly ignored directories
exclude = [
    ".bzr",
    ".direnv",
    ".eggs",
    ".git",
    ".git-rewrite",
    ".hg",
    ".mypy_cache",
    ".nox",
    ".pants.d",
    ".pytype",
    ".ruff_cache",
    ".svn",
    ".tox",
    ".venv",
    "__pypackages__",
    "_build",
    "buck-out",
    "build",
    "dist",
    "node_modules",
    "venv",
    "migrations"]

# Per-file ignores
[per-file-ignores]
"__init__.py" = ["F401", "F403"]
"tests/*" = ["S101", "S105", "S106", "ARG001", "PLR2004"]
"migrations/*" = ["ALL"]
"conftest.py" = ["ARG001"]
"settings*.py" = ["F401", "F403", "ERA001"]

[lint.mccabe]
max-complexity = 10

[lint.isort]
known-third-party = [${this.getFrameworkImports(config.framework).split(',').map(i => `"${i.trim()}"`).join(', ')}]

[lint.flake8-pytest-style]
fixture-parentheses = true
mark-parentheses = true

[lint.flake8-quotes]
inline-quotes = "double"
multiline-quotes = "double"
docstring-quotes = "double"

[lint.pylint]
max-args = 5
max-attributes = 7
max-bool-expr = 5
max-branches = 12
max-locals = 15
max-public-methods = 20
max-returns = 6
max-statements = 50

[format]
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false
line-ending = "auto"
`;
  }

  protected generatePreCommitConfig(config: CodeQualityConfig): string {
    return `# Pre-commit hooks configuration
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-json
      - id: check-toml
      - id: check-xml
      - id: check-merge-conflict
      - id: check-case-conflict
      - id: check-docstring-first
      - id: debug-statements
      - id: detect-private-key
      - id: fix-byte-order-marker
      - id: mixed-line-ending
      - id: name-tests-test
        args: ['--pytest-test-first']

  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        language_version: python${config.pythonVersion || '3.11'}
        args: ['--config', 'pyproject.toml']

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort
        args: ['--settings-path', '.isort.cfg']

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.14
    hooks:
      - id: ruff
        args: ['--fix', '--exit-non-zero-on-fix']

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [${this.getFrameworkTypingDeps(config.framework)}]
        args: ['--config-file', 'mypy.ini']

  - repo: https://github.com/pycqa/bandit
    rev: 1.7.6
    hooks:
      - id: bandit
        args: ["-c", "pyproject.toml"]
        exclude: tests/

  - repo: https://github.com/Lucas-C/pre-commit-hooks-safety
    rev: v1.3.3
    hooks:
      - id: python-safety-dependencies-check

  - repo: https://github.com/asottile/pyupgrade
    rev: v3.15.0
    hooks:
      - id: pyupgrade
        args: ['--py${(config.pythonVersion || '3.11').replace('.', '')}-plus']

  - repo: https://github.com/hadialqattan/pycln
    rev: v2.4.0
    hooks:
      - id: pycln
        args: ['--all']

  - repo: https://github.com/commitizen-tools/commitizen
    rev: v3.13.0
    hooks:
      - id: commitizen
      - id: commitizen-branch
        stages: [push]

  - repo: https://github.com/pycqa/docformatter
    rev: v1.7.5
    hooks:
      - id: docformatter
        args: ['--in-place', '--wrap-summaries', '88', '--wrap-descriptions', '88']

  - repo: https://github.com/PyCQA/autoflake
    rev: v2.2.1
    hooks:
      - id: autoflake
        args: [
          '--in-place',
          '--remove-all-unused-imports',
          '--remove-unused-variables',
          '--remove-duplicate-keys',
          '--ignore-init-module-imports'
        ]

  - repo: local
    hooks:
      - id: pytest-check
        name: pytest-check
        entry: pytest
        language: system
        pass_filenames: false
        always_run: true
        args: ['--tb=short', '-q']
        stages: [commit]

default_language_version:
  python: python${config.pythonVersion || '3.11'}

ci:
  autofix_commit_msg: |
    [pre-commit.ci] auto fixes from pre-commit.com hooks
    
    for more information, see https://pre-commit.ci
  autofix_prs: true
  autoupdate_branch: ''
  autoupdate_commit_msg: '[pre-commit.ci] pre-commit autoupdate'
  autoupdate_schedule: weekly
  skip: []
  submodules: false
`;
  }

  protected generateVSCodeSettings(config: CodeQualityConfig): string {
    return JSON.stringify({
      "python.linting.enabled": true,
      "python.linting.pylintEnabled": false,
      "python.linting.flake8Enabled": false,
      "python.linting.mypyEnabled": true,
      "python.linting.mypyArgs": [
        "--config-file=mypy.ini"
      ],
      "python.formatting.provider": "black",
      "python.formatting.blackArgs": [
        "--config",
        "pyproject.toml"
      ],
      "editor.formatOnSave": true,
      "editor.formatOnSaveMode": "file",
      "python.sortImports.args": [
        "--settings-path",
        ".isort.cfg"
      ],
      "[python]": {
        "editor.codeActionsOnSave": {
          "source.organizeImports": true
        }
      },
      "ruff.enable": true,
      "ruff.lint.run": "onType",
      "ruff.lint.args": [],
      "ruff.importStrategy": "fromEnvironment",
      "ruff.fixAll": true,
      "ruff.organizeImports": true,
      "python.testing.pytestEnabled": true,
      "python.testing.unittestEnabled": false,
      "python.testing.pytestArgs": [
        "tests",
        "--cov=.",
        "--cov-report=html",
        "--cov-report=term-missing"
      ],
      "python.analysis.typeCheckingMode": "strict",
      "python.analysis.autoImportCompletions": true,
      "python.analysis.completeFunctionParens": true,
      "python.analysis.inlayHints.functionReturnTypes": true,
      "python.analysis.inlayHints.variableTypes": true,
      "python.analysis.inlayHints.parameterTypes": true,
      "editor.rulers": [88],
      "editor.wordWrap": "on",
      "editor.wordWrapColumn": 88,
      "files.trimTrailingWhitespace": true,
      "files.insertFinalNewline": true,
      "files.trimFinalNewlines": true,
      "files.associations": {
        "*.py": "python",
        "*.pyi": "python",
        "*.pyx": "python",
        "*.pxd": "python",
        "*.pyw": "python"
      },
      "files.exclude": {
        "**/__pycache__": true,
        "**/*.pyc": true,
        "**/*.pyo": true,
        "**/*.pyd": true,
        "**/.Python": true,
        "**/.mypy_cache": true,
        "**/.pytest_cache": true,
        "**/.ruff_cache": true,
        "**/htmlcov": true,
        "**/.coverage": true,
        "**/.coverage.*": true,
        "**/coverage.xml": true,
        "**/*.cover": true
      },
      "search.exclude": {
        "**/migrations": true,
        "**/venv": true,
        "**/.venv": true,
        "**/site-packages": true,
        "**/dist": true,
        "**/build": true,
        "**/*.egg-info": true
      }
    }, null, 2);
  }

  protected generateQualityMakefile(config: CodeQualityConfig): string {
    return `.PHONY: format lint type-check test quality

# Variables
PYTHON := python
PIP := pip
BLACK := black
ISORT := isort
MYPY := mypy
RUFF := ruff
BANDIT := bandit
PYLINT := pylint
PYTEST := pytest
PRE_COMMIT := pre-commit

# Directories
SRC_DIR := app src ${config.framework.toLowerCase()}
TEST_DIR := tests
ALL_DIRS := $(SRC_DIR) $(TEST_DIR)

# Colors
GREEN := \\033[0;32m
RED := \\033[0;31m
YELLOW := \\033[0;33m
NC := \\033[0m # No Color

# Install quality tools
install-quality:
	@echo "$(GREEN)Installing quality tools...$(NC)"
	$(PIP) install -U black isort mypy ruff bandit pylint pre-commit pyupgrade
	$(PRE_COMMIT) install
	@echo "$(GREEN)Quality tools installed!$(NC)"

# Format code
format:
	@echo "$(YELLOW)Formatting code with Black...$(NC)"
	black .
	@echo "$(YELLOW)Sorting imports with isort...$(NC)"
	isort .
	@echo "$(YELLOW)Fixing with Ruff...$(NC)"
	$(RUFF) check --fix $(ALL_DIRS)
	@echo "$(GREEN)Code formatted!$(NC)"

# Lint code
lint:
	@echo "$(YELLOW)Linting with Ruff...$(NC)"
	ruff check .
	@echo "$(YELLOW)Security check with Bandit...$(NC)"
	$(BANDIT) -r $(SRC_DIR) -f json -o bandit-report.json || true
	@echo "$(GREEN)Linting complete!$(NC)"

# Type checking
type-check:
	@echo "$(YELLOW)Type checking with mypy...$(NC)"
	mypy .
	@echo "$(GREEN)Type checking complete!$(NC)"

# Security scanning
security:
	@echo "$(YELLOW)Running security scan...$(NC)"
	$(BANDIT) -r $(SRC_DIR) -ll
	@echo "$(GREEN)Security scan complete!$(NC)"

# Run tests
test:
	@echo "$(YELLOW)Running tests with pytest...$(NC)"
	pytest
	@echo "$(GREEN)Tests complete!$(NC)"

# Run all quality checks
quality: format lint type-check security
	@echo "$(GREEN)All quality checks passed!$(NC)"${config.enableAutofix ? '\n\n# Fix all auto-fixable issues\nfix:\n\t@echo "$(YELLOW)Fixing with Ruff...$(NC)"\n\truff check --fix .\n\t@echo "$(GREEN)Fixed!$(NC)"' : ''}${config.enablePreCommit ? '\n\n# Pre-commit checks\npre-commit:\n\t@echo "$(YELLOW)Running pre-commit hooks...$(NC)"\n\tpre-commit run --all-files\n\t@echo "$(GREEN)Pre-commit checks passed!$(NC)"\n\n# Install pre-commit hooks\ninstall-hooks:\n\t@echo "$(YELLOW)Installing pre-commit hooks...$(NC)"\n\tpre-commit install\n\t@echo "$(GREEN)Pre-commit hooks installed!$(NC)"' : ''}

# Run quality checks without formatting
check-quality:
	@echo "$(YELLOW)Checking code format...$(NC)"
	$(BLACK) --check $(ALL_DIRS)
	$(ISORT) --check-only $(ALL_DIRS)
	@echo "$(YELLOW)Running linters...$(NC)"
	$(RUFF) check $(ALL_DIRS)
	@echo "$(YELLOW)Running type checker...$(NC)"
	$(MYPY) $(SRC_DIR)
	@echo "$(YELLOW)Running security scanner...$(NC)"
	$(BANDIT) -r $(SRC_DIR) -ll
	@echo "$(GREEN)All quality checks passed!$(NC)"

# Pre-commit checks
pre-commit:
	@echo "$(YELLOW)Running pre-commit hooks...$(NC)"
	$(PRE_COMMIT) run --all-files
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

# Update pre-commit hooks
update-pre-commit:
	@echo "$(YELLOW)Updating pre-commit hooks...$(NC)"
	$(PRE_COMMIT) autoupdate
	@echo "$(GREEN)Pre-commit hooks updated!$(NC)"

# Clean quality artifacts
clean-quality:
	@echo "$(YELLOW)Cleaning quality artifacts...$(NC)"
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "htmlcov" -exec rm -rf {} +
	rm -f bandit-report.json
	@echo "$(GREEN)Cleaned!$(NC)"

# Generate quality report
quality-report:
	@echo "$(YELLOW)Generating quality report...$(NC)"
	$(PYTHON) scripts/quality_check.py
	@echo "$(GREEN)Quality report generated!$(NC)"

# Watch mode for continuous quality checks
watch-quality:
	@echo "$(YELLOW)Starting quality watch mode...$(NC)"
	watchmedo shell-command \\
		--patterns="*.py" \\
		--recursive \\
		--command='make check-quality' \\
		.

# Help
help-quality:
	@echo "Quality commands:"
	@echo "  make install-quality  - Install all quality tools"
	@echo "  make format          - Format code with Black and isort"
	@echo "  make lint            - Run linters (Ruff, Bandit)"
	@echo "  make type-check      - Run type checker (mypy)"
	@echo "  make security        - Run security scanner"
	@echo "  make quality         - Run all quality checks with formatting"
	@echo "  make check-quality   - Run all quality checks without formatting"
	@echo "  make pre-commit      - Run pre-commit hooks"
	@echo "  make clean-quality   - Clean quality artifacts"
	@echo "  make quality-report  - Generate quality report"
`;
  }

  protected generateQualityCheckScript(config: CodeQualityConfig): string {
    return `#!/usr/bin/env python3
"""Comprehensive code quality checker."""

import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class QualityResult:
    """Result of a quality check."""
    tool: str
    passed: bool
    score: Optional[float] = None
    issues: List[Dict[str, any]] = None
    output: str = ""
    duration: float = 0.0


class QualityChecker:
    """Run quality checks and generate reports."""
    
    def __init__(self, src_dirs: List[str] = None):
        self.src_dirs = src_dirs or ["app", "src", "${config.framework.toLowerCase()}"]
        self.results: List[QualityResult] = []
    
    def run_all_checks(self) -> bool:
        """Run all quality checks."""
        print("🔍 Running comprehensive quality checks...\\n")
        
        checks = [
            ("Black", self.run_black),
            ("isort", self.run_isort),
            ("Ruff", self.run_ruff),
            ("mypy", self.run_mypy),
            ("Bandit", self.run_security_checks),
            ("Test Coverage", self.run_tests)]
        
        all_passed = True
        
        for name, check_func in checks:
            print(f"Running {name}...", end=" ", flush=True)
            result = check_func()
            self.results.append(result)
            
            if result.passed:
                print("✅ PASSED")
            else:
                print("❌ FAILED")
                all_passed = False
            
            if result.score is not None:
                print(f"  Score: {result.score:.2f}%")
            if result.issues:
                print(f"  Issues: {len(result.issues)}")
        
        return all_passed
    
    def run_black(self) -> QualityResult:
        """Check code formatting with Black."""
        start = datetime.now()
        
        try:
            cmd = ["black", "--check"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            passed = result.returncode == 0
            output = result.stdout + result.stderr
            
            # Count unformatted files
            issues = []
            if not passed:
                for line in output.split("\\n"):
                    if "would reformat" in line:
                        issues.append({"file": line.split()[0], "type": "formatting"})
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="black",
                passed=passed,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="black",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def run_isort(self) -> QualityResult:
        """Check import sorting with isort."""
        start = datetime.now()
        
        try:
            cmd = ["isort", "--check-only"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            passed = result.returncode == 0
            output = result.stdout + result.stderr
            
            issues = []
            if not passed:
                for line in output.split("\\n"):
                    if "ERROR:" in line:
                        issues.append({"file": line.split()[-1], "type": "import_order"})
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="isort",
                passed=passed,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="isort",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def run_ruff(self) -> QualityResult:
        """Check code quality with Ruff."""
        start = datetime.now()
        
        try:
            cmd = ["ruff", "check", "--output-format", "json"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            issues = []
            if result.stdout:
                try:
                    issues = json.loads(result.stdout)
                except json.JSONDecodeError:
                    pass
            
            passed = len(issues) == 0
            
            # Calculate score based on issue severity
            score = 100.0
            if issues:
                error_count = sum(1 for i in issues if i.get("code", "").startswith("E"))
                warning_count = len(issues) - error_count
                score = max(0, 100 - (error_count * 5) - (warning_count * 2))
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="ruff",
                passed=passed,
                score=score,
                issues=issues,
                output=result.stderr,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="ruff",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def run_mypy(self) -> QualityResult:
        """Check type annotations with mypy."""
        start = datetime.now()
        
        try:
            cmd = ["mypy", "--json-report", ".mypy_report"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            output = result.stdout + result.stderr
            
            # Parse JSON report if available
            issues = []
            score = 100.0
            
            report_file = Path(".mypy_report/index.json")
            if report_file.exists():
                with open(report_file) as f:
                    report = json.load(f)
                    
                total_lines = report.get("total_lines", 1)
                typed_lines = report.get("typed_lines", 0)
                score = (typed_lines / total_lines) * 100 if total_lines > 0 else 0
                
                # Parse errors from output
                for line in output.split("\\n"):
                    if ": error:" in line:
                        parts = line.split(":")
                        if len(parts) >= 4:
                            issues.append({
                                "file": parts[0],
                                "line": parts[1],
                                "type": "type_error",
                                "message": ":".join(parts[3:]).strip()
                            })
            
            passed = result.returncode == 0
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="mypy",
                passed=passed,
                score=score,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="mypy",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def run_security_checks(self) -> QualityResult:
        """Run security checks with Bandit."""
        start = datetime.now()
        
        try:
            cmd = ["bandit", "-r", "."] + ["-f", "json"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            issues = []
            score = 100.0
            
            if result.stdout:
                try:
                    report = json.loads(result.stdout)
                    issues = report.get("results", [])
                    
                    # Calculate score based on severity
                    high_count = sum(1 for i in issues if i.get("issue_severity") == "HIGH")
                    medium_count = sum(1 for i in issues if i.get("issue_severity") == "MEDIUM")
                    low_count = sum(1 for i in issues if i.get("issue_severity") == "LOW")
                    
                    score = max(0, 100 - (high_count * 20) - (medium_count * 10) - (low_count * 5))
                except json.JSONDecodeError:
                    pass
            
            passed = len(issues) == 0
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="bandit",
                passed=passed,
                score=score,
                issues=issues,
                output=result.stderr,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="bandit",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def run_tests(self) -> QualityResult:
        """Run tests with coverage."""
        start = datetime.now()
        
        try:
            cmd = ["pytest", "--cov=.", "--cov-report=json", "--tb=short", "-q"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            output = result.stdout + result.stderr
            passed = result.returncode == 0
            
            # Parse coverage report
            score = 0.0
            issues = []
            
            coverage_file = Path("coverage.json")
            if coverage_file.exists():
                with open(coverage_file) as f:
                    coverage = json.load(f)
                    score = coverage.get("totals", {}).get("percent_covered", 0)
            
            # Parse test failures
            if not passed:
                for line in output.split("\\n"):
                    if "FAILED" in line:
                        issues.append({"test": line.strip(), "type": "test_failure"})
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="pytest",
                passed=passed,
                score=score,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="pytest",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_black(self) -> QualityResult:
        """Check code formatting with Black."""
        start = datetime.now()
        
        try:
            cmd = ["black", "--check"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            passed = result.returncode == 0
            output = result.stdout + result.stderr
            
            # Count unformatted files
            issues = []
            if not passed:
                for line in output.split("\\n"):
                    if "would reformat" in line:
                        issues.append({"file": line.split()[0], "type": "formatting"})
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="black",
                passed=passed,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="black",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_isort(self) -> QualityResult:
        """Check import sorting with isort."""
        start = datetime.now()
        
        try:
            cmd = ["isort", "--check-only"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            passed = result.returncode == 0
            output = result.stdout + result.stderr
            
            issues = []
            if not passed:
                for line in output.split("\\n"):
                    if "ERROR:" in line:
                        issues.append({"file": line.split()[-1], "type": "import_order"})
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="isort",
                passed=passed,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="isort",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_ruff(self) -> QualityResult:
        """Check code quality with Ruff."""
        start = datetime.now()
        
        try:
            cmd = ["ruff", "check", "--output-format", "json"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            issues = []
            if result.stdout:
                try:
                    issues = json.loads(result.stdout)
                except json.JSONDecodeError:
                    pass
            
            passed = len(issues) == 0
            
            # Calculate score based on issue severity
            score = 100.0
            if issues:
                error_count = sum(1 for i in issues if i.get("code", "").startswith("E"))
                warning_count = len(issues) - error_count
                score = max(0, 100 - (error_count * 5) - (warning_count * 2))
            
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="ruff",
                passed=passed,
                score=score,
                issues=issues,
                output=result.stderr,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="ruff",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_mypy(self) -> QualityResult:
        """Check type annotations with mypy."""
        start = datetime.now()
        
        try:
            cmd = ["mypy", "--json-report", ".mypy_report"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            output = result.stdout + result.stderr
            
            # Parse JSON report if available
            issues = []
            score = 100.0
            
            report_file = Path(".mypy_report/index.json")
            if report_file.exists():
                with open(report_file) as f:
                    report = json.load(f)
                    
                total_lines = report.get("total_lines", 1)
                typed_lines = report.get("typed_lines", 0)
                score = (typed_lines / total_lines) * 100 if total_lines > 0 else 0
                
                # Parse errors from output
                for line in output.split("\\n"):
                    if ": error:" in line:
                        parts = line.split(":")
                        if len(parts) >= 4:
                            issues.append({
                                "file": parts[0],
                                "line": parts[1],
                                "type": "type_error",
                                "message": ":".join(parts[3:]).strip()
                            })
            
            passed = result.returncode == 0
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="mypy",
                passed=passed,
                score=score,
                issues=issues,
                output=output,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="mypy",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_bandit(self) -> QualityResult:
        """Check security issues with Bandit."""
        start = datetime.now()
        
        try:
            cmd = ["bandit", "-r", "-f", "json"] + self.src_dirs
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            issues = []
            if result.stdout:
                try:
                    report = json.loads(result.stdout)
                    issues = report.get("results", [])
                except json.JSONDecodeError:
                    pass
            
            # Calculate security score
            score = 100.0
            if issues:
                high_severity = sum(1 for i in issues if i.get("issue_severity") == "HIGH")
                medium_severity = sum(1 for i in issues if i.get("issue_severity") == "MEDIUM")
                low_severity = sum(1 for i in issues if i.get("issue_severity") == "LOW")
                
                score = max(0, 100 - (high_severity * 10) - (medium_severity * 5) - (low_severity * 2))
            
            passed = len(issues) == 0
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="bandit",
                passed=passed,
                score=score,
                issues=issues,
                output=result.stderr,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="bandit",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def check_coverage(self) -> QualityResult:
        """Check test coverage."""
        start = datetime.now()
        
        try:
            # Run tests with coverage
            cmd = ["pytest", "--cov=" + ",".join(self.src_dirs), "--cov-report=json", "--quiet"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            score = 0.0
            issues = []
            
            # Parse coverage report
            coverage_file = Path("coverage.json")
            if coverage_file.exists():
                with open(coverage_file) as f:
                    coverage = json.load(f)
                    score = coverage.get("totals", {}).get("percent_covered", 0)
                    
                    # Find files with low coverage
                    for file, data in coverage.get("files", {}).items():
                        file_coverage = data.get("summary", {}).get("percent_covered", 100)
                        if file_coverage < 80:
                            issues.append({
                                "file": file,
                                "type": "low_coverage",
                                "coverage": file_coverage,
                                "missing_lines": data.get("missing_lines", [])
                            })
            
            passed = score >= 80  # 80% coverage threshold
            duration = (datetime.now() - start).total_seconds()
            
            return QualityResult(
                tool="coverage",
                passed=passed,
                score=score,
                issues=issues,
                output=result.stdout + result.stderr,
                duration=duration
            )
        except Exception as e:
            return QualityResult(
                tool="coverage",
                passed=False,
                output=str(e),
                duration=(datetime.now() - start).total_seconds()
            )
    
    def generate_report(self, output_file: str = "quality_report.json") -> None:
        """Generate quality report."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_checks": len(self.results),
                "passed": sum(1 for r in self.results if r.passed),
                "failed": sum(1 for r in self.results if not r.passed),
                "total_issues": sum(len(r.issues) if r.issues else 0 for r in self.results),
                "overall_score": sum(r.score for r in self.results if r.score) / sum(1 for r in self.results if r.score),
                "total_duration": sum(r.duration for r in self.results)
            },
            "results": [
                {
                    "tool": r.tool,
                    "passed": r.passed,
                    "score": r.score,
                    "issues_count": len(r.issues) if r.issues else 0,
                    "issues": r.issues[:10] if r.issues else [],  # Top 10 issues
                    "duration": r.duration
                }
                for r in self.results
            ]
        }
        
        with open(output_file, "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\\n📊 Quality report saved to {output_file}")
        print(f"\\n✨ Overall Score: {report['summary']['overall_score']:.2f}%")
        print(f"🎯 Passed: {report['summary']['passed']}/{report['summary']['total_checks']}")
        print(f"⚠️  Issues: {report['summary']['total_issues']}")
        print(f"⏱️  Duration: {report['summary']['total_duration']:.2f}s")


def main():
    """Main entry point."""
    # Detect source directories
    src_dirs = []
    for dir_name in ["app", "src", "${config.framework.toLowerCase()}"]:
        if Path(dir_name).exists():
            src_dirs.append(dir_name)
    
    if not src_dirs:
        print("❌ No source directories found!")
        sys.exit(1)
    
    checker = QualityChecker(src_dirs)
    all_passed = checker.run_all_checks()
    
    print("\\n" + "="*60)
    checker.generate_report()
    
    if not all_passed:
        print("\\n❌ Some quality checks failed!")
        sys.exit(1)
    else:
        print("\\n✅ All quality checks passed!")


if __name__ == "__main__":
    main()
`;
  }

  private getFrameworkImports(framework: string): string {
    const imports: { [key: string]: string } = {
      'fastapi': 'fastapi,pydantic,starlette,uvicorn',
      'django': 'django,rest_framework,celery',
      'flask': 'flask,werkzeug,jinja2,click',
      'tornado': 'tornado',
      'sanic': 'sanic,aiofiles,ujson'
    };
    return imports[framework] || '';
  }

  private getFrameworkModules(framework: string): string {
    const modules: { [key: string]: string } = {
      'fastapi': 'fastapi,starlette',
      'django': 'django,rest_framework',
      'flask': 'flask,werkzeug',
      'tornado': 'tornado',
      'sanic': 'sanic'
    };
    return modules[framework] || '';
  }

  private getFrameworkMypySettings(framework: string): string {
    const settings: { [key: string]: string } = {
      'django': `
# Django settings
[mypy.plugins.django-stubs]
django_settings_module = "settings"`,
      'fastapi': `
# FastAPI settings
[[tool.mypy.overrides]]
module = "fastapi.*"
ignore_missing_imports = false`,
      'flask': `
# Flask settings
[[tool.mypy.overrides]]
module = "flask.*"
ignore_missing_imports = false`,
      default: ''
    };
    return settings[framework] || settings.default;
  }

  private getFrameworkMypyPlugins(framework: string): string {
    const plugins: { [key: string]: string } = {
      'django': 'mypy_django_plugin.main',
      'fastapi': 'pydantic.mypy',
      default: 'pydantic.mypy'
    };
    return plugins[framework] || plugins.default;
  }

  private getFrameworkMypyModules(framework: string): string {
    const modules: { [key: string]: string } = {
      'django': `
[mypy-django.*]
ignore_missing_imports = False

[mypy-rest_framework.*]
ignore_missing_imports = False`,
      'fastapi': `
[mypy-fastapi.*]
ignore_missing_imports = False

[mypy-pydantic.*]
ignore_missing_imports = False`,
      'flask': `
[mypy-flask.*]
ignore_missing_imports = False

[mypy-werkzeug.*]
ignore_missing_imports = False`,
      default: ''
    };
    return modules[framework] || modules.default;
  }

  private getFrameworkTypingDeps(framework: string): string {
    const deps: { [key: string]: string } = {
      'django': 'django-stubs,djangorestframework-stubs,types-requests',
      'fastapi': 'types-requests,types-redis,types-python-jose',
      'flask': 'types-flask,types-requests,types-werkzeug',
      'tornado': 'types-tornado,types-requests',
      'sanic': 'types-requests,types-redis',
      default: 'types-requests'
    };
    return deps[framework] || deps.default;
  }
}

export const pythonCodeQualityGenerator = new PythonCodeQualityGenerator();