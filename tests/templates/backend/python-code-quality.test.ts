import { describe, it, expect, beforeEach } from 'vitest';
import { PythonCodeQualityGenerator } from '../../../src/templates/backend/python-code-quality';

describe('PythonCodeQualityGenerator', () => {
  let generator: PythonCodeQualityGenerator;

  beforeEach(() => {
    generator = new PythonCodeQualityGenerator();
  });

  describe('generateCodeQualityConfig', () => {
    it('should generate basic code quality configuration', () => {
      const config = {
        framework: 'fastapi'
      };

      const files = generator.generateCodeQualityConfig(config);

      expect(files).toHaveLength(6);
      expect(files.map(f => f.path)).toContain('pyproject.toml');
      expect(files.map(f => f.path)).toContain('.isort.cfg');
      expect(files.map(f => f.path)).toContain('mypy.ini');
      expect(files.map(f => f.path)).toContain('ruff.toml');
      expect(files.map(f => f.path)).toContain('Makefile.quality');
      expect(files.map(f => f.path)).toContain('scripts/quality_check.py');
    });

    it('should include pre-commit configuration when enabled', () => {
      const config = {
        framework: 'django',
        enablePreCommit: true
      };

      const files = generator.generateCodeQualityConfig(config);

      expect(files).toHaveLength(7);
      expect(files.map(f => f.path)).toContain('.pre-commit-config.yaml');
    });

    it('should include VS Code settings when enabled', () => {
      const config = {
        framework: 'flask',
        enableVSCode: true
      };

      const files = generator.generateCodeQualityConfig(config);

      expect(files).toHaveLength(7);
      expect(files.map(f => f.path)).toContain('.vscode/settings.json');
    });

    it('should include both pre-commit and VS Code when both enabled', () => {
      const config = {
        framework: 'tornado',
        enablePreCommit: true,
        enableVSCode: true
      };

      const files = generator.generateCodeQualityConfig(config);

      expect(files).toHaveLength(8);
      expect(files.map(f => f.path)).toContain('.pre-commit-config.yaml');
      expect(files.map(f => f.path)).toContain('.vscode/settings.json');
    });
  });

  describe('pyproject.toml generation', () => {
    it('should generate comprehensive Black configuration', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject).toBeDefined();
      expect(pyproject!.content).toContain('[tool.black]');
      expect(pyproject!.content).toContain('line-length = 88');
      expect(pyproject!.content).toContain("target-version = ['py311']");
      expect(pyproject!.content).toContain('include = \'\\.pyi?$\'');
    });

    it('should generate isort configuration in pyproject.toml', () => {
      const config = { framework: 'django' };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain('[tool.isort]');
      expect(pyproject!.content).toContain('profile = "black"');
      expect(pyproject!.content).toContain('multi_line_output = 3');
      expect(pyproject!.content).toContain('include_trailing_comma = true');
    });

    it('should generate mypy configuration in pyproject.toml', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain('[tool.mypy]');
      expect(pyproject!.content).toContain('python_version = "3.11"');
      expect(pyproject!.content).toContain('warn_return_any = true');
      expect(pyproject!.content).toContain('warn_unused_configs = true');
    });

    it('should include strict mode settings when enabled', () => {
      const config = { 
        framework: 'fastapi',
        enableStrict: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain('disallow_untyped_defs = true');
      expect(pyproject!.content).toContain('disallow_any_unimported = true');
      expect(pyproject!.content).toContain('no_implicit_optional = true');
      expect(pyproject!.content).toContain('check_untyped_defs = true');
    });

    it('should include coverage configuration', () => {
      const config = { framework: 'tornado' };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain('[tool.coverage.run]');
      expect(pyproject!.content).toContain('source = ["."]');
      expect(pyproject!.content).toContain('omit = ["*/tests/*", "*/test_*", "*/__pycache__/*", "*/venv/*", "*/.venv/*", "*/site-packages/*", "*/migrations/*"]');
      expect(pyproject!.content).toContain('[tool.coverage.report]');
      expect(pyproject!.content).toContain('precision = 2');
    });

    it('should include pytest configuration', () => {
      const config = { framework: 'sanic' };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain('[tool.pytest.ini_options]');
      expect(pyproject!.content).toContain('minversion = "6.0"');
      expect(pyproject!.content).toContain('addopts = "-ra -q --strict-markers"');
      expect(pyproject!.content).toContain('testpaths = ["tests"]');
    });

    it('should use custom Python version when specified', () => {
      const config = { 
        framework: 'django',
        pythonVersion: '3.12'
      };
      const files = generator.generateCodeQualityConfig(config);
      const pyproject = files.find(f => f.path === 'pyproject.toml');

      expect(pyproject!.content).toContain("target-version = ['py312']");
      expect(pyproject!.content).toContain('python_version = "3.12"');
    });
  });

  describe('.isort.cfg generation', () => {
    it('should generate isort configuration file', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCodeQualityConfig(config);
      const isort = files.find(f => f.path === '.isort.cfg');

      expect(isort).toBeDefined();
      expect(isort!.content).toContain('[settings]');
      expect(isort!.content).toContain('profile = black');
      expect(isort!.content).toContain('multi_line_output = 3');
      expect(isort!.content).toContain('include_trailing_comma = True');
      expect(isort!.content).toContain('force_grid_wrap = 0');
      expect(isort!.content).toContain('use_parentheses = True');
      expect(isort!.content).toContain('ensure_newline_before_comments = True');
      expect(isort!.content).toContain('line_length = 88');
    });

    it('should include framework-specific imports', () => {
      const frameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic'];
      
      frameworks.forEach(framework => {
        const config = { framework };
        const files = generator.generateCodeQualityConfig(config);
        const isort = files.find(f => f.path === '.isort.cfg');

        expect(isort!.content).toContain('known_third_party =');
        
        if (framework === 'fastapi') {
          expect(isort!.content).toContain('fastapi,starlette');
        } else if (framework === 'django') {
          expect(isort!.content).toContain('django,rest_framework');
        } else if (framework === 'flask') {
          expect(isort!.content).toContain('flask,werkzeug');
        } else if (framework === 'tornado') {
          expect(isort!.content).toContain('tornado');
        } else if (framework === 'sanic') {
          expect(isort!.content).toContain('sanic');
        }
      });
    });
  });

  describe('mypy.ini generation', () => {
    it('should generate mypy configuration file', () => {
      const config = { framework: 'django' };
      const files = generator.generateCodeQualityConfig(config);
      const mypy = files.find(f => f.path === 'mypy.ini');

      expect(mypy).toBeDefined();
      expect(mypy!.content).toContain('[mypy]');
      expect(mypy!.content).toContain('python_version = 3.11');
      expect(mypy!.content).toContain('warn_return_any = True');
      expect(mypy!.content).toContain('warn_unused_configs = True');
    });

    it('should include framework-specific plugins', () => {
      const config = { framework: 'django' };
      const files = generator.generateCodeQualityConfig(config);
      const mypy = files.find(f => f.path === 'mypy.ini');

      expect(mypy!.content).toContain('plugins = mypy_django_plugin.main');
      expect(mypy!.content).toContain('[mypy.plugins.django-stubs]');
      expect(mypy!.content).toContain('django_settings_module = "settings"');
    });

    it('should include SQLAlchemy plugin for appropriate frameworks', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCodeQualityConfig(config);
      const mypy = files.find(f => f.path === 'mypy.ini');

      expect(mypy!.content).toContain('plugins = pydantic.mypy');
    });

    it('should include strict settings when enabled', () => {
      const config = { 
        framework: 'flask',
        enableStrict: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const mypy = files.find(f => f.path === 'mypy.ini');

      expect(mypy!.content).toContain('disallow_untyped_defs = True');
      expect(mypy!.content).toContain('disallow_any_unimported = True');
      expect(mypy!.content).toContain('no_implicit_optional = True');
      expect(mypy!.content).toContain('check_untyped_defs = True');
      expect(mypy!.content).toContain('disallow_untyped_calls = True');
      expect(mypy!.content).toContain('disallow_incomplete_defs = True');
    });

    it('should exclude tests and migrations', () => {
      const config = { framework: 'tornado' };
      const files = generator.generateCodeQualityConfig(config);
      const mypy = files.find(f => f.path === 'mypy.ini');

      expect(mypy!.content).toContain('exclude = ^(tests/|migrations/|venv/|.venv/)');
    });
  });

  describe('ruff.toml generation', () => {
    it('should generate Ruff configuration', () => {
      const config = { framework: 'sanic' };
      const files = generator.generateCodeQualityConfig(config);
      const ruff = files.find(f => f.path === 'ruff.toml');

      expect(ruff).toBeDefined();
      expect(ruff!.content).toContain('target-version = "py311"');
      expect(ruff!.content).toContain('line-length = 88');
      expect(ruff!.content).toContain('indent-width = 4');
    });

    it('should include comprehensive linting rules', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCodeQualityConfig(config);
      const ruff = files.find(f => f.path === 'ruff.toml');

      expect(ruff!.content).toContain('[lint]');
      expect(ruff!.content).toContain('select = [');
      expect(ruff!.content).toContain('"E",  # pycodestyle errors');
      expect(ruff!.content).toContain('"W",  # pycodestyle warnings');
      expect(ruff!.content).toContain('"F",  # pyflakes');
      expect(ruff!.content).toContain('"B",  # flake8-bugbear');
      expect(ruff!.content).toContain('"I",  # isort');
    });

    it('should include autofix settings when enabled', () => {
      const config = { 
        framework: 'django',
        enableAutofix: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const ruff = files.find(f => f.path === 'ruff.toml');

      expect(ruff!.content).toContain('[lint]');
      expect(ruff!.content).toContain('fixable = ["ALL"]');
      expect(ruff!.content).toContain('unfixable = []');
    });

    it('should include format configuration', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCodeQualityConfig(config);
      const ruff = files.find(f => f.path === 'ruff.toml');

      expect(ruff!.content).toContain('[format]');
      expect(ruff!.content).toContain('quote-style = "double"');
      expect(ruff!.content).toContain('indent-style = "space"');
      expect(ruff!.content).toContain('skip-magic-trailing-comma = false');
    });
  });

  describe('pre-commit configuration', () => {
    it('should generate pre-commit configuration when enabled', () => {
      const config = { 
        framework: 'fastapi',
        enablePreCommit: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const preCommit = files.find(f => f.path === '.pre-commit-config.yaml');

      expect(preCommit).toBeDefined();
      expect(preCommit!.content).toContain('repos:');
      expect(preCommit!.content).toContain('- repo: https://github.com/psf/black');
      expect(preCommit!.content).toContain('- repo: https://github.com/pycqa/isort');
      expect(preCommit!.content).toContain('- repo: https://github.com/pre-commit/mirrors-mypy');
      expect(preCommit!.content).toContain('- repo: https://github.com/astral-sh/ruff-pre-commit');
    });

    it('should include security checks', () => {
      const config = { 
        framework: 'django',
        enablePreCommit: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const preCommit = files.find(f => f.path === '.pre-commit-config.yaml');

      expect(preCommit!.content).toContain('- repo: https://github.com/pycqa/bandit');
      expect(preCommit!.content).toContain('id: bandit');
      expect(preCommit!.content).toContain('args: ["-c", "pyproject.toml"]');
    });

    it('should include safety checks', () => {
      const config = { 
        framework: 'flask',
        enablePreCommit: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const preCommit = files.find(f => f.path === '.pre-commit-config.yaml');

      expect(preCommit!.content).toContain('- repo: https://github.com/Lucas-C/pre-commit-hooks-safety');
      expect(preCommit!.content).toContain('id: python-safety-dependencies-check');
    });
  });

  describe('VS Code settings', () => {
    it('should generate VS Code settings when enabled', () => {
      const config = { 
        framework: 'tornado',
        enableVSCode: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const vscode = files.find(f => f.path === '.vscode/settings.json');

      expect(vscode).toBeDefined();
      
      const settings = JSON.parse(vscode!.content);
      expect(settings['python.linting.enabled']).toBe(true);
      expect(settings['python.linting.pylintEnabled']).toBe(false);
      expect(settings['python.linting.flake8Enabled']).toBe(false);
      expect(settings['python.linting.mypyEnabled']).toBe(true);
      expect(settings['python.formatting.provider']).toBe('black');
    });

    it('should include isort configuration', () => {
      const config = { 
        framework: 'sanic',
        enableVSCode: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const vscode = files.find(f => f.path === '.vscode/settings.json');

      const settings = JSON.parse(vscode!.content);
      expect(settings['[python]']['editor.codeActionsOnSave']['source.organizeImports']).toBe(true);
    });

    it('should include test configuration', () => {
      const config = { 
        framework: 'fastapi',
        enableVSCode: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const vscode = files.find(f => f.path === '.vscode/settings.json');

      const settings = JSON.parse(vscode!.content);
      expect(settings['python.testing.pytestEnabled']).toBe(true);
      expect(settings['python.testing.unittestEnabled']).toBe(false);
      expect(settings['python.testing.pytestArgs']).toContain('--cov=.');
    });
  });

  describe('Makefile.quality generation', () => {
    it('should generate quality Makefile', () => {
      const config = { framework: 'django' };
      const files = generator.generateCodeQualityConfig(config);
      const makefile = files.find(f => f.path === 'Makefile.quality');

      expect(makefile).toBeDefined();
      expect(makefile!.content).toContain('.PHONY: format lint type-check test quality');
      expect(makefile!.content).toContain('format:');
      expect(makefile!.content).toContain('black .');
      expect(makefile!.content).toContain('isort .');
    });

    it('should include all quality commands', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCodeQualityConfig(config);
      const makefile = files.find(f => f.path === 'Makefile.quality');

      expect(makefile!.content).toContain('lint:');
      expect(makefile!.content).toContain('ruff check .');
      expect(makefile!.content).toContain('type-check:');
      expect(makefile!.content).toContain('mypy .');
      expect(makefile!.content).toContain('test:');
      expect(makefile!.content).toContain('pytest');
    });

    it('should include autofix when enabled', () => {
      const config = { 
        framework: 'fastapi',
        enableAutofix: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const makefile = files.find(f => f.path === 'Makefile.quality');

      expect(makefile!.content).toContain('fix:');
      expect(makefile!.content).toContain('ruff check --fix .');
    });

    it('should include pre-commit when enabled', () => {
      const config = { 
        framework: 'tornado',
        enablePreCommit: true
      };
      const files = generator.generateCodeQualityConfig(config);
      const makefile = files.find(f => f.path === 'Makefile.quality');

      expect(makefile!.content).toContain('pre-commit:');
      expect(makefile!.content).toContain('pre-commit run --all-files');
      expect(makefile!.content).toContain('install-hooks:');
      expect(makefile!.content).toContain('pre-commit install');
    });
  });

  describe('quality_check.py script', () => {
    it('should generate quality check script', () => {
      const config = { framework: 'sanic' };
      const files = generator.generateCodeQualityConfig(config);
      const script = files.find(f => f.path === 'scripts/quality_check.py');

      expect(script).toBeDefined();
      expect(script!.content).toContain('#!/usr/bin/env python3');
      expect(script!.content).toContain('"""Comprehensive code quality checker."""');
      expect(script!.content).toContain('import subprocess');
      expect(script!.content).toContain('import sys');
    });

    it('should include all quality checks', () => {
      const config = { framework: 'django' };
      const files = generator.generateCodeQualityConfig(config);
      const script = files.find(f => f.path === 'scripts/quality_check.py');

      expect(script!.content).toContain('def run_black(');
      expect(script!.content).toContain('def run_isort(');
      expect(script!.content).toContain('def run_ruff(');
      expect(script!.content).toContain('def run_mypy(');
      expect(script!.content).toContain('def run_tests(');
      expect(script!.content).toContain('def run_security_checks(');
    });

    it('should include report generation', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCodeQualityConfig(config);
      const script = files.find(f => f.path === 'scripts/quality_check.py');

      expect(script!.content).toContain('def generate_report(self');
      expect(script!.content).toContain('Quality report saved to');
      expect(script!.content).toContain('Passed:');
      expect(script!.content).toContain('Overall Score:');
    });

    it('should include bandit security checks', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCodeQualityConfig(config);
      const script = files.find(f => f.path === 'scripts/quality_check.py');

      expect(script!.content).toContain('cmd = ["bandit"');
      expect(script!.content).toContain('"-r"');
      expect(script!.content).toContain('"-f", "json"');
    });
  });
});