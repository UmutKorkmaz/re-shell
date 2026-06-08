'use strict';

/**
 * Minimal Re-Shell plugin fixture. Exports an activate() so the plugin loader
 * has a real entry point to call; the install tests only need a valid manifest
 * plus an index, so the body is intentionally trivial.
 */
module.exports = {
  activate() {
    return { ok: true };
  },
};
