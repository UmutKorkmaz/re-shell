'use strict';

// Legacy @re-shell/ scoped plugin fixture. It carries no reshell manifest key
// or keyword on purpose: detection must still succeed purely via the legacy
// recognized scope.
module.exports = {
  activate() {
    return { ok: true, legacy: true };
  },
};
