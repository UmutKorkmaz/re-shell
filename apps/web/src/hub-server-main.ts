import { startHubServer, stopHubServer, type HubServerInfo } from './hub-server.js';

/**
 * Standalone entry point for the hub server. The CLI launcher spawns the
 * compiled bundle of THIS file with `node`, so it must actually start the
 * server (the hub-server module only exports `startHubServer`/`stopHubServer`
 * and does nothing on import).
 *
 * Graceful shutdown is wired here so that whether the hub is killed directly or
 * its parent dies, it tears down the HTTP server, every active job, and every
 * WebSocket connection via `stopHubServer` before the process exits.
 */

// Time the graceful drain is allowed to take before we hard-exit. The parent
// launcher gives the hub a SIGTERM grace window of its own; this is the hub's
// internal upper bound so a stuck `server.close()` can never wedge the process.
const SHUTDOWN_DRAIN_MS = 3000;

async function main(): Promise<void> {
  let info: HubServerInfo;
  try {
    info = await startHubServer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[hub-server] Failed to start: ${message}`);
    process.exit(1);
    return;
  }

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[hub-server] Received ${signal}, shutting down...`);

    // Hard-exit guard: if the graceful drain stalls, force the process down so
    // the port is always released and no orphan lingers.
    const forceExit = setTimeout(() => {
      console.error('[hub-server] Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_DRAIN_MS);
    forceExit.unref();

    stopHubServer(info.server)
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((err: unknown) => {
        clearTimeout(forceExit);
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[hub-server] Error during shutdown: ${message}`);
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // A parent that dies without signalling still detaches our stdio; treat a
  // disconnect/EPIPE on stdout as a teardown trigger so we never linger.
  process.on('disconnect', () => shutdown('SIGTERM'));

  // Opt-in parent-lifetime tie for launchers that own the hub through a stdin
  // pipe (the desktop shell). When the parent exits for ANY reason — a clean
  // quit, a crash, SIGKILL — the OS closes its end of the pipe, stdin hits EOF
  // and the hub shuts down instead of lingering as an orphan on its port. The
  // parent can also close the pipe deliberately for a graceful stop, which works
  // identically on every platform (no signals needed). Off by default so the
  // CLI-managed flow, whose stdin is a terminal or /dev/null, is unchanged.
  if (process.env.RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE === '1') {
    process.stdin.on('end', () => shutdown('SIGTERM'));
    process.stdin.on('close', () => shutdown('SIGTERM'));
    process.stdin.on('error', () => shutdown('SIGTERM'));
    process.stdin.resume();
  }
}

void main();
