import { describe, it, expect } from 'vitest';
import { applyPlaceholders, buildPlaceholderValues, createBackendTemplate } from '../../src/utils/backend-scaffold';
import { backendTemplates, getBackendTemplate } from '../../src/templates/backend/index';

const ctx = { name: 'my-service', normalizedName: 'my-service', port: '8080', org: 'Acme Corp' };

describe('backend scaffold placeholders', () => {
  it('derives every naming convention from the project name', () => {
    const v = buildPlaceholderValues(ctx, 'java');
    expect(v).toMatchObject({
      serviceName: 'my-service',
      projectNamePascal: 'MyService',
      ProjectName: 'MyService',
      projectNameCamel: 'myService',
      projectNameSnake: 'my_service',
      projectGroup: 'com.acmecorp',
      projectPackage: 'com.acmecorp.myservice',
      packagePath: 'com/acmecorp/myservice',
      packageName: 'com.acmecorp.myservice',
      PORT: '8080',
    });
    // Non-JVM templates keep packageName as the package-manager name.
    expect(buildPlaceholderValues(ctx, 'typescript').packageName).toBe('my-service');
    // A digit-first name still yields a valid JVM package segment.
    expect(buildPlaceholderValues({ ...ctx, normalizedName: '9lives' }, 'java').projectPackage).toBe('com.acmecorp.app9lives');
  });

  it('leaves unknown placeholders (Helm / Go template syntax) untouched', () => {
    const v = buildPlaceholderValues(ctx);
    expect(applyPlaceholders('{{ .Values.x }} {{end}} {{projectName}}', v)).toBe('{{ .Values.x }} {{end}} my-service');
  });

  it('substitutes placeholders in file paths, not only contents (micronaut)', async () => {
    const files = await createBackendTemplate(getBackendTemplate('micronaut')!, ctx);
    const app = files.find(f => f.path.endsWith('/Application.java'));
    expect(app?.path).toBe('src/main/java/com/acmecorp/myservice/Application.java');
    expect(app?.content).toContain('package com.acmecorp.myservice;');
    expect(files.some(f => f.path.includes('{{'))).toBe(false);
  });

  it('no registered backend template leaves a known placeholder behind', async () => {
    const known = Object.keys(buildPlaceholderValues(ctx));
    const leftovers: string[] = [];
    for (const [id, template] of Object.entries(backendTemplates)) {
      const files = await createBackendTemplate(template, ctx);
      for (const f of files) {
        for (const key of known) {
          if (f.path.includes(`{{${key}}}`) || f.content.includes(`{{${key}}}`)) {
            leftovers.push(`${id}:${f.path}:{{${key}}}`);
          }
        }
      }
    }
    expect(leftovers).toEqual([]);
  });
});
