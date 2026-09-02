import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks whether the API is currently slow or unreachable, so the whole app can say so in one
 * place instead of each page rendering as if it simply had no data.
 *
 * The API runs on Container Apps with min-replicas 0 and a database that auto-pauses, so it goes
 * back to sleep whenever nobody uses it for a while. That is what keeps it free, but it means a
 * signed-in person who leaves a tab open over lunch comes back to requests that take most of a
 * minute. Without an explanation those pages look broken rather than busy.
 */
@Injectable({ providedIn: 'root' })
export class ApiHealthService {
  /** Requests that have been in flight long enough to be worth explaining. */
  private readonly slowRequests = signal(0);
  private readonly startedAt = signal(0);

  readonly seconds = signal(0);
  readonly waking = computed(() => this.slowRequests() > 0);

  private ticker?: ReturnType<typeof setInterval>;

  /** A request has crossed the "this is taking a while" threshold. */
  beginSlow(): void {
    this.slowRequests.update(n => n + 1);
    if (this.slowRequests() === 1) {
      this.startedAt.set(Date.now());
      this.seconds.set(0);
      this.ticker = setInterval(
        () => this.seconds.set(Math.round((Date.now() - this.startedAt()) / 1000)), 1000);
    }
  }

  /** That request finished, one way or the other. */
  endSlow(): void {
    this.slowRequests.update(n => Math.max(0, n - 1));
    if (this.slowRequests() === 0) this.stopTicker();
  }

  /** Something proved the API is answering again — drop the banner immediately. */
  clear(): void {
    this.slowRequests.set(0);
    this.stopTicker();
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = undefined;
  }
}

/**
 * Gateway and connection failures, which is what a sleeping container looks like from the browser.
 * A 503 from our own readiness endpoint is included deliberately: it means "not ready yet", which
 * is exactly the case worth waiting through.
 */
export function isColdStartError(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}
