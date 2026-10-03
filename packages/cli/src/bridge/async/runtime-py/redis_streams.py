"""Redis Streams transport (redis-py). Same stream layout as the TypeScript adapter:
XADD <channel> body <json> [key <k>] h:<header> <value> ...; consumer groups with
XACK after the handler returns; un-acked entries are re-read on start and taken
over from dead consumers with XAUTOCLAIM.
"""

from __future__ import annotations

import os
import socket
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import redis

from .core import TransportMessage


def _entries(reply: Any) -> List[Tuple[str, Optional[Dict[str, str]]]]:
    """Entries of the single stream in an XREADGROUP reply (RESP2 list or RESP3 dict)."""
    if not reply:
        return []
    if isinstance(reply, dict):
        reply = list(reply.items())
    first = reply[0]
    items = first[1] if isinstance(first, (list, tuple)) else []
    return [(entry_id, fields) for entry_id, fields in items]


def _to_message(channel: str, fields: Dict[str, str], delivery_count: int) -> TransportMessage:
    headers = {k[2:]: v for k, v in fields.items() if k.startswith("h:")}
    return TransportMessage(channel=channel, body=fields.get("body", ""), headers=headers, key=fields.get("key"), delivery_count=delivery_count)


class _Sub:
    def __init__(self, stop: Callable[[], None]) -> None:
        self._stop = stop

    def stop(self) -> None:
        self._stop()


class RedisStreamsTransport:
    name = "redis-streams"

    def __init__(
        self,
        url: str = "redis://localhost:6379",
        client: Optional["redis.Redis"] = None,
        max_len: int = 100_000,
        block_ms: int = 1000,
        batch_size: int = 10,
        claim_idle_ms: int = 30_000,
        consumer_name: Optional[str] = None,
        on_error: Optional[Callable[[BaseException], None]] = None,
    ) -> None:
        self._client: "redis.Redis" = client or redis.Redis.from_url(url, decode_responses=True)
        self._max_len = max_len
        self._block_ms = block_ms
        self._batch = batch_size
        self._claim_idle_ms = claim_idle_ms
        self._consumer = consumer_name or f"{socket.gethostname()}-{os.getpid()}-{os.urandom(3).hex()}"
        self._on_error = on_error or (lambda _e: None)
        self._stops: List[threading.Event] = []
        self._threads: List[threading.Thread] = []

    def publish(self, channel: str, body: str, headers: Dict[str, str], key: Optional[str] = None) -> None:
        fields: Dict[str, str] = {"body": body}
        if key is not None:
            fields["key"] = key
        for name, value in headers.items():
            fields[f"h:{name}"] = value
        self._client.xadd(channel, fields, maxlen=self._max_len, approximate=True)  # type: ignore[arg-type]

    def subscribe(self, channel: str, group: str, handler: Callable[[TransportMessage], None], start_from: str = "latest") -> _Sub:
        try:
            self._client.xgroup_create(channel, group, id="0" if start_from == "beginning" else "$", mkstream=True)
        except redis.ResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise
        stop = threading.Event()
        self._stops.append(stop)
        reader: "redis.Redis" = redis.Redis(connection_pool=redis.ConnectionPool(**self._client.connection_pool.connection_kwargs))  # dedicated connection for blocking reads

        def deliveries(entry_id: str) -> int:
            try:
                rows = self._client.xpending_range(channel, group, entry_id, entry_id, 1)
                return int(rows[0]["times_delivered"]) if rows else 1
            except Exception:  # noqa: BLE001
                return 1

        def handle(entries: List[Tuple[str, Optional[Dict[str, str]]]], first_delivery: bool) -> None:
            for entry_id, fields in entries:
                if stop.is_set():
                    return
                if fields is None:
                    self._client.xack(channel, group, entry_id)
                    continue
                try:
                    handler(_to_message(channel, fields, 1 if first_delivery else deliveries(entry_id)))
                    self._client.xack(channel, group, entry_id)
                except Exception as error:  # noqa: BLE001 - stays pending; redelivered
                    self._on_error(error)

        def loop() -> None:
            backlog_done = False
            last_claim = time.monotonic()
            while not stop.is_set():
                try:
                    if not backlog_done:
                        entries = _entries(reader.xreadgroup(group, self._consumer, {channel: "0"}, count=self._batch))
                        if not entries:
                            backlog_done = True
                        else:
                            handle(entries, False)
                        continue
                    if (time.monotonic() - last_claim) * 1000 >= max(500, self._claim_idle_ms / 2):
                        last_claim = time.monotonic()
                        claimed = reader.xautoclaim(channel, group, self._consumer, self._claim_idle_ms, "0-0", count=self._batch)
                        handle([(i, f) for i, f in claimed[1]], False)
                    entries = _entries(reader.xreadgroup(group, self._consumer, {channel: ">"}, count=self._batch, block=self._block_ms))
                    if entries:
                        handle(entries, True)
                except Exception as error:  # noqa: BLE001
                    if stop.is_set():
                        break
                    self._on_error(error)
                    time.sleep(0.25)
            reader.close()

        thread = threading.Thread(target=loop, daemon=True)
        thread.start()
        self._threads.append(thread)

        def stop_fn() -> None:
            stop.set()
            thread.join(timeout=self._block_ms / 1000.0 + 2)

        return _Sub(stop_fn)

    def close(self) -> None:
        for s in self._stops:
            s.set()
        for t in self._threads:
            t.join(timeout=self._block_ms / 1000.0 + 2)
        self._client.close()
