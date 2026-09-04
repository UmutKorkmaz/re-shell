import { describe, expect, it } from 'vitest';
import {
  PortManager,
  generatePortForwardingConfig,
  getServicePorts,
} from '../../src/utils/dev-env-setup';

describe('PortManager', () => {
  it('allocates the preferred port when available', () => {
    const pm = new PortManager();
    const port = pm.allocatePort(4000, 'test-service');
    expect(port).toBe(4000);
  });

  it('auto-allocates from range when no preferred port', () => {
    const pm = new PortManager();
    const port = pm.allocatePort(undefined, 'svc');
    expect(port).toBeGreaterThan(0);
  });

  it('releases a port so it can be re-allocated', () => {
    const pm = new PortManager();
    const port = pm.allocatePort(5000, 'svc');
    pm.releasePort(port);
    const port2 = pm.allocatePort(5000, 'svc2');
    expect(port2).toBe(5000);
  });
});

describe('generatePortForwardingConfig', () => {
  it('generates forwarding config string', () => {
    const config = generatePortForwardingConfig([
      { service: 'web', localPort: 3000, containerPort: 3000 },
      { service: 'api', localPort: 8000, containerPort: 8000, description: 'API server' },
    ]);
    expect(config).toContain('Port Forwarding Configuration');
    expect(config).toContain('localhost:3000');
    expect(config).toContain('localhost:8000');
  });

  it('returns header for empty ports', () => {
    const config = generatePortForwardingConfig([]);
    expect(config).toContain('Port Forwarding Configuration');
  });
});

describe('getServicePorts', () => {
  it('returns common service ports', () => {
    const ports = getServicePorts();
    expect(ports['web']).toBe(3000);
    expect(ports['api']).toBe(8000);
    expect(ports['redis']).toBe(6379);
    expect(Object.keys(ports).length).toBeGreaterThan(5);
  });
});
