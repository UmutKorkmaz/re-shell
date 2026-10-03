"""In-memory transport (threads): same contract as the broker adapters, for tests."""

from __future__ import annotations

import threading
from typing import Callable, Dict, List, Optional

from .core import TransportMessage


class _Group:
    def __init__(self) -> None:
        self.queue: List[TransportMessage] = []
        self.members: List["_Member"] = []
        self.cond = threading.Condition()


class _Member:
    def __init__(self, handler: Callable[[TransportMessage], None]) -> None:
        self.handler = handler
        self.stopped = False


class _Sub:
    def __init__(self, stop: Callable[[], None]) -> None:
        self._stop = stop

    def stop(self) -> None:
        self._stop()


class MemoryTransport:
    name = "memory"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._groups: Dict[str, Dict[str, _Group]] = {}
        self._history: Dict[str, List[TransportMessage]] = {}
        self._threads: List[threading.Thread] = []
        self._closed = False
        self.fail_publish_with: Optional[Exception] = None

    def publish(self, channel: str, body: str, headers: Dict[str, str], key: Optional[str] = None) -> None:
        if self._closed:
            raise RuntimeError("transport is closed")
        if self.fail_publish_with is not None:
            raise self.fail_publish_with
        with self._lock:
            self._history.setdefault(channel, []).append(TransportMessage(channel, body, dict(headers), key))
            groups = list(self._groups.get(channel, {}).values())
        for g in groups:
            with g.cond:
                g.queue.append(TransportMessage(channel, body, dict(headers), key))
                g.cond.notify_all()

    def published(self, channel: str) -> List[TransportMessage]:
        with self._lock:
            return list(self._history.get(channel, []))

    def subscribe(self, channel: str, group: str, handler: Callable[[TransportMessage], None], start_from: str = "latest") -> _Sub:
        with self._lock:
            by_group = self._groups.setdefault(channel, {})
            g = by_group.get(group)
            if g is None:
                g = by_group[group] = _Group()
                if start_from == "beginning":
                    g.queue.extend(TransportMessage(m.channel, m.body, dict(m.headers), m.key) for m in self._history.get(channel, []))
        member = _Member(handler)
        with g.cond:
            g.members.append(member)

        def loop() -> None:
            assert g is not None
            while not member.stopped and not self._closed:
                with g.cond:
                    while not g.queue and not member.stopped and not self._closed:
                        g.cond.wait(0.1)
                    if member.stopped or self._closed or not g.queue:
                        continue
                    message = g.queue.pop(0)
                try:
                    member.handler(message)
                except Exception:  # noqa: BLE001 - redeliver
                    message.delivery_count += 1
                    with g.cond:
                        g.queue.insert(0, message)

        thread = threading.Thread(target=loop, daemon=True)
        thread.start()
        self._threads.append(thread)

        def stop() -> None:
            member.stopped = True
            with g.cond:
                g.cond.notify_all()

        return _Sub(stop)

    def close(self) -> None:
        self._closed = True
