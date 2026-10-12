/** Cardinality is bounded by registered route patterns, standard methods and status codes. */
export class HttpMetrics {
  private readonly entries = new Map<string, { count: number; seconds: number }>();

  record(method: string, route: string, status: number, milliseconds: number): void {
    const verb = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(method) ? method : 'OTHER';
    const labels = `method="${verb}",route="${route.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",status="${status}"`;
    const previous = this.entries.get(labels) ?? { count: 0, seconds: 0 };
    previous.count += 1;
    previous.seconds += Math.max(0, milliseconds) / 1000;
    this.entries.set(labels, previous);
  }

  render(): string {
    const lines = [
      '# HELP re_shell_http_requests_total Completed HTTP requests.',
      '# TYPE re_shell_http_requests_total counter',
      '# HELP re_shell_http_request_duration_seconds HTTP response duration.',
      '# TYPE re_shell_http_request_duration_seconds summary',
    ];
    for (const [labels, entry] of this.entries) {
      lines.push(`re_shell_http_requests_total{${labels}} ${entry.count}`,
        `re_shell_http_request_duration_seconds_sum{${labels}} ${entry.seconds}`,
        `re_shell_http_request_duration_seconds_count{${labels}} ${entry.count}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
