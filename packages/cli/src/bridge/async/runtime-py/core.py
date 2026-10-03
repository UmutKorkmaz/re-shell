"""re-shell async runtime (Python): envelopes, W3C tracing, schema evolution,
circuit breaker, retry, service discovery and a typed message bus.

Wire-compatible with the TypeScript runtime: the same envelope JSON, the same
transport headers and the same Redis Streams / discovery conventions, so a
Python service and a TypeScript service can exchange messages with the
correlation id and trace intact.
"""

from __future__ import annotations

import contextvars
import json
import os
import random
import re
import secrets
import socket
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Mapping, Optional, Protocol, TypeVar

T = TypeVar("T")

# ---------------------------------------------------------------------------
# W3C trace context
# ---------------------------------------------------------------------------

_TRACEPARENT = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    sampled: bool = True


def _hex(nbytes: int) -> str:
    while True:
        value = secrets.token_hex(nbytes)
        if value.strip("0"):
            return value


def new_trace_context() -> TraceContext:
    return TraceContext(_hex(16), _hex(8), True)


def format_traceparent(ctx: TraceContext) -> str:
    return f"00-{ctx.trace_id}-{ctx.span_id}-{'01' if ctx.sampled else '00'}"


def parse_traceparent(value: Optional[str]) -> Optional[TraceContext]:
    if not value:
        return None
    m = _TRACEPARENT.match(value.strip().lower())
    if not m:
        return None
    trace_id, span_id, flags = m.groups()
    if not trace_id.strip("0") or not span_id.strip("0"):
        return None
    return TraceContext(trace_id, span_id, (int(flags, 16) & 1) == 1)


def child_of(parent: Optional[TraceContext]) -> TraceContext:
    if parent is None:
        return new_trace_context()
    return TraceContext(parent.trace_id, _hex(8), parent.sampled)


def new_correlation_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Envelope
# ---------------------------------------------------------------------------

Envelope = Dict[str, Any]


class EnvelopeError(ValueError):
    pass


def create_envelope(
    *,
    type: str,
    schema_version: int,
    correlation_id: str,
    traceparent: str,
    source: str,
    payload: Any,
    causation_id: Optional[str] = None,
) -> Envelope:
    env: Envelope = {
        "id": str(uuid.uuid4()),
        "type": type,
        "schemaVersion": schema_version,
        "correlationId": correlation_id,
        "traceparent": traceparent,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "payload": payload,
    }
    if causation_id:
        env["causationId"] = causation_id
    return env


def encode_envelope(env: Envelope) -> str:
    return json.dumps(env, separators=(",", ":"))


def decode_envelope(raw: "str | bytes") -> Envelope:
    try:
        value = json.loads(raw)
    except ValueError:
        raise EnvelopeError("message body is not valid JSON") from None
    if not isinstance(value, dict):
        raise EnvelopeError("message body is not an object")
    for key in ("id", "type", "correlationId", "traceparent", "source", "timestamp"):
        if not isinstance(value.get(key), str) or value[key] == "":
            raise EnvelopeError(f"envelope.{key} must be a non-empty string")
    version = value.get("schemaVersion")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise EnvelopeError("envelope.schemaVersion must be a positive integer")
    if "payload" not in value:
        raise EnvelopeError("envelope.payload is missing")
    if "causationId" in value and not isinstance(value["causationId"], str):
        raise EnvelopeError("envelope.causationId must be a string")
    return value


def envelope_headers(env: Envelope) -> Dict[str, str]:
    headers = {
        "x-message-id": env["id"],
        "x-message-type": env["type"],
        "x-schema-version": str(env["schemaVersion"]),
        "x-correlation-id": env["correlationId"],
        "traceparent": env["traceparent"],
        "x-source": env["source"],
    }
    if env.get("causationId"):
        headers["x-causation-id"] = env["causationId"]
    return headers


# ---------------------------------------------------------------------------
# Ambient context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MessageContext:
    correlation_id: str
    traceparent: str
    message_id: str


_current: "contextvars.ContextVar[Optional[MessageContext]]" = contextvars.ContextVar("reshell_message_context", default=None)


def current_context() -> Optional[MessageContext]:
    return _current.get()


# ---------------------------------------------------------------------------
# Schema evolution
# ---------------------------------------------------------------------------

Upcaster = Callable[[Any], Any]


class SchemaVersionError(Exception):
    pass


class ValidationError(Exception):
    def __init__(self, message_type: str, problems: List[str]) -> None:
        super().__init__(f"{message_type} payload is invalid: {'; '.join(problems)}")
        self.problems = problems


@dataclass
class MessageDefinition:
    type: str
    channel: str
    current_version: int
    schema: Dict[str, Any]
    upcasters: Dict[int, Upcaster] = field(default_factory=dict)
    min_version: int = 1

    def __post_init__(self) -> None:
        if self.current_version < 1 or not (1 <= self.min_version <= self.current_version):
            raise ValueError(f"{self.type}: invalid version range")
        for v in range(self.min_version, self.current_version):
            if v not in self.upcasters:
                raise ValueError(f"{self.type}: no upcaster from v{v} to v{v + 1}")


def upcast_payload(definition: MessageDefinition, payload: Any, from_version: int, accept_newer: bool = False) -> Any:
    if from_version == definition.current_version:
        return payload
    if from_version > definition.current_version:
        if accept_newer:
            return payload
        raise SchemaVersionError(f"{definition.type} v{from_version} was produced by a newer schema (current v{definition.current_version})")
    if from_version < definition.min_version:
        raise SchemaVersionError(f"{definition.type} v{from_version} is older than the oldest supported version v{definition.min_version}")
    value = payload
    for v in range(from_version, definition.current_version):
        value = definition.upcasters[v](value)
    return value


def _check(spec: Any, value: Any, path: str, problems: List[str]) -> None:
    if isinstance(spec, dict):
        if not isinstance(value, dict):
            problems.append(f"{path} must be an object")
            return
        for name, sub in spec.items():
            _check(sub, value.get(name), f"{path}.{name}" if path else name, problems)
        return
    s = str(spec).strip()
    optional = s.endswith("?")
    if optional:
        s = s[:-1]
    if value is None:
        if not optional:
            problems.append(f"{path} is required")
        return
    if s.endswith("[]"):
        if not isinstance(value, list):
            problems.append(f"{path} must be an array")
            return
        for i, item in enumerate(value):
            _check(s[:-2], item, f"{path}[{i}]", problems)
        return
    m = re.match(r"^enum\((.*)\)$", s)
    if m:
        if not isinstance(value, str) or value not in m.group(1).split("|"):
            problems.append(f"{path} must be one of {m.group(1)}")
        return
    is_num = isinstance(value, (int, float)) and not isinstance(value, bool)
    if s == "string":
        if not isinstance(value, str):
            problems.append(f"{path} must be a string")
    elif s == "datetime":
        ok = isinstance(value, str)
        if ok:
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                ok = False
        if not ok:
            problems.append(f"{path} must be an ISO-8601 datetime string")
    elif s == "number":
        if not is_num:
            problems.append(f"{path} must be a number")
    elif s == "integer":
        if not (isinstance(value, int) and not isinstance(value, bool)) and not (isinstance(value, float) and value.is_integer()):
            problems.append(f"{path} must be an integer")
    elif s == "boolean":
        if not isinstance(value, bool):
            problems.append(f"{path} must be a boolean")
    elif s == "object":
        if not isinstance(value, dict):
            problems.append(f"{path} must be an object")
    elif s != "any":
        problems.append(f"{path}: unknown type {s!r} in schema")


def validate_payload(schema: Dict[str, Any], payload: Any) -> List[str]:
    if not isinstance(payload, dict):
        return ["payload must be an object"]
    problems: List[str] = []
    for name, spec in schema.items():
        _check(spec, payload.get(name), name, problems)
    return problems


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------


class CircuitOpenError(Exception):
    def __init__(self, name: str, retry_after_ms: float) -> None:
        super().__init__(f'circuit "{name}" is open; retry in {int(retry_after_ms)}ms')
        self.retry_after_ms = retry_after_ms


class CircuitBreaker:
    """closed -> open -> half-open -> closed (thread-safe)."""

    def __init__(
        self,
        name: str = "breaker",
        failure_threshold: int = 5,
        reset_timeout_ms: float = 10_000,
        half_open_max_calls: int = 1,
        success_threshold: int = 1,
        now: Callable[[], float] = time.monotonic,
        on_state_change: Optional[Callable[[str, str, str], None]] = None,
    ) -> None:
        if min(failure_threshold, half_open_max_calls, success_threshold) < 1:
            raise ValueError("breaker thresholds must be >= 1")
        self.name = name
        self._threshold = failure_threshold
        self._reset_ms = reset_timeout_ms
        self._probes_max = half_open_max_calls
        self._success_threshold = success_threshold
        self._now = now
        self._on_change = on_state_change
        self._lock = threading.Lock()
        self._state = "closed"
        self._failures = 0
        self._successes = 0
        self._probes = 0
        self._opened_at = 0.0

    def _transition(self, to: str) -> None:
        if self._state == to:
            return
        old, self._state = self._state, to
        if to == "open":
            self._opened_at = self._now()
        if to == "closed":
            self._failures = 0
        self._successes = 0
        self._probes = 0
        if self._on_change:
            self._on_change(to, old, self.name)

    def _maybe_half_open(self) -> None:
        if self._state == "open" and (self._now() - self._opened_at) * 1000 >= self._reset_ms:
            self._transition("half-open")

    @property
    def state(self) -> str:
        with self._lock:
            self._maybe_half_open()
            return self._state

    def execute(self, fn: Callable[[], T]) -> T:
        with self._lock:
            self._maybe_half_open()
            if self._state == "open":
                raise CircuitOpenError(self.name, self._reset_ms - (self._now() - self._opened_at) * 1000)
            probe = False
            if self._state == "half-open":
                if self._probes >= self._probes_max:
                    raise CircuitOpenError(self.name, 0)
                self._probes += 1
                probe = True
        try:
            result = fn()
        except BaseException:
            with self._lock:
                if probe:
                    self._probes = max(0, self._probes - 1)
                if self._state == "half-open":
                    self._transition("open")
                elif self._state == "closed":
                    self._failures += 1
                    if self._failures >= self._threshold:
                        self._transition("open")
            raise
        with self._lock:
            if probe:
                self._probes = max(0, self._probes - 1)
            if self._state == "half-open":
                self._successes += 1
                if self._successes >= self._success_threshold:
                    self._transition("closed")
            elif self._state == "closed":
                self._failures = 0
        return result


# ---------------------------------------------------------------------------
# Retry
# ---------------------------------------------------------------------------


class RetryExhaustedError(Exception):
    def __init__(self, attempts: int, cause: BaseException) -> None:
        super().__init__(f"gave up after {attempts} attempt(s): {cause}")
        self.attempts = attempts
        self.cause = cause


def backoff_delay(attempt: int, base_ms: float = 100, factor: float = 2, max_ms: float = 5000, jitter: bool = True, rnd: Callable[[], float] = random.random) -> float:
    raw = min(max_ms, base_ms * (factor ** (attempt - 1)))
    return float(int(rnd() * raw)) if jitter else raw


def retry(
    fn: Callable[[int], T],
    max_attempts: int = 3,
    base_ms: float = 100,
    max_ms: float = 5000,
    factor: float = 2,
    jitter: bool = True,
    sleep: Callable[[float], None] = time.sleep,
    should_retry: Optional[Callable[[BaseException, int], bool]] = None,
) -> T:
    last: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn(attempt)
        except Exception as error:  # noqa: BLE001 - retry any failure
            last = error
            if should_retry is not None and not should_retry(error, attempt):
                raise
            if attempt == max_attempts:
                break
            sleep(backoff_delay(attempt, base_ms, factor, max_ms, jitter) / 1000.0)
    assert last is not None
    raise RetryExhaustedError(max_attempts, last)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


class ServiceNotFoundError(Exception):
    pass


@dataclass
class Endpoint:
    name: str
    source: str
    url: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None


def env_name(service: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", service.upper())


class ServiceDiscovery:
    """env (<NAME>_URL | _ADDR | _HOST+_PORT) -> registry file -> DNS SRV."""

    def __init__(
        self,
        env: Optional[Mapping[str, str]] = None,
        registry_path: Optional[str] = None,
        srv_domain: Optional[str] = None,
        resolve_srv: Optional[Callable[[str], List[Any]]] = None,
        read_file: Optional[Callable[[str], str]] = None,
    ) -> None:
        self._env: Mapping[str, str] = env if env is not None else os.environ
        self._registry = registry_path
        self._domain = srv_domain
        self._resolve_srv = resolve_srv
        self._read = read_file or (lambda p: open(p, encoding="utf-8").read())

    def _from_env(self, service: str) -> List[Endpoint]:
        key = env_name(service)
        url = self._env.get(f"{key}_URL")
        if url:
            return [Endpoint(service, "env", url=url)]
        addr = self._env.get(f"{key}_ADDR")
        if addr:
            host, _, port = addr.partition(":")
            return [Endpoint(service, "env", url=addr, host=host, port=int(port) if port else None)]
        host_value = self._env.get(f"{key}_HOST")
        if host_value:
            port_value = self._env.get(f"{key}_PORT")
            return [Endpoint(service, "env", host=host_value, port=int(port_value) if port_value else None)]
        return []

    def _from_registry(self, service: str) -> List[Endpoint]:
        path = self._registry or self._env.get("SERVICE_REGISTRY") or "./services.registry.json"
        try:
            text = self._read(path)
        except OSError:
            return []
        try:
            doc = json.loads(text)
        except ValueError:
            raise ValueError(f"service registry {path} is not valid JSON") from None
        entry = (doc.get("services") or {}).get(service)
        if not entry:
            return []
        instances = entry.get("instances") or [entry]
        return [Endpoint(service, "registry", url=i.get("url"), host=i.get("host"), port=i.get("port")) for i in instances]

    def _from_srv(self, service: str) -> List[Endpoint]:
        domain = self._domain or self._env.get("SERVICE_DISCOVERY_DOMAIN")
        if not domain:
            return []
        name = f"_{service}._tcp.{domain}"
        try:
            if self._resolve_srv is not None:
                records = self._resolve_srv(name)
            else:  # pragma: no cover - needs a resolver library / network
                import dns.resolver  # type: ignore[import-not-found,unused-ignore]

                records = [
                    {"name": str(r.target).rstrip("."), "port": r.port, "priority": r.priority, "weight": r.weight}
                    for r in dns.resolver.resolve(name, "SRV")
                ]
        except Exception:  # noqa: BLE001
            return []
        ordered = sorted(records, key=lambda r: (r["priority"], -r["weight"]))
        return [Endpoint(service, "dns-srv", url=f"tcp://{r['name']}:{r['port']}", host=r["name"], port=r["port"]) for r in ordered]

    def resolve_all(self, service: str) -> List[Endpoint]:
        for source in (self._from_env, self._from_registry, self._from_srv):
            found = source(service)
            if found:
                return found
        raise ServiceNotFoundError(f'service "{service}" not found (tried: env {env_name(service)}_URL, registry file, dns-srv)')

    def resolve(self, service: str) -> Endpoint:
        return self.resolve_all(service)[0]


# ---------------------------------------------------------------------------
# Transport contract + message bus
# ---------------------------------------------------------------------------


@dataclass
class TransportMessage:
    channel: str
    body: str
    headers: Dict[str, str] = field(default_factory=dict)
    key: Optional[str] = None
    delivery_count: int = 1


class Subscription(Protocol):
    def stop(self) -> None: ...


class Transport(Protocol):
    name: str

    def publish(self, channel: str, body: str, headers: Dict[str, str], key: Optional[str] = None) -> None: ...

    def subscribe(self, channel: str, group: str, handler: Callable[[TransportMessage], None], start_from: str = "latest") -> Subscription: ...

    def close(self) -> None: ...


def dead_letter_channel(channel: str) -> str:
    return f"{channel}.dlq"


class MessageBus:
    """Typed publish/subscribe with correlation, tracing, evolution, breaker, retry and DLQ."""

    def __init__(
        self,
        transport: Transport,
        service: str,
        breaker: Optional[Dict[str, Any]] = None,
        use_breaker: bool = True,
        publish_attempts: int = 3,
        handler_attempts: int = 3,
        retry_base_ms: float = 50,
        retry_max_ms: float = 1000,
        accept_newer: bool = False,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.transport = transport
        self.service = service
        self._breaker_options = breaker or {}
        self._use_breaker = use_breaker
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._publish_attempts = publish_attempts
        self._handler_attempts = handler_attempts
        self._retry_base_ms = retry_base_ms
        self._retry_max_ms = retry_max_ms
        self._accept_newer = accept_newer
        self._sleep = sleep
        self._subs: List[Subscription] = []

    def breaker_for(self, channel: str) -> Optional[CircuitBreaker]:
        if not self._use_breaker:
            return None
        if channel not in self._breakers:
            self._breakers[channel] = CircuitBreaker(name=f"publish:{channel}", **self._breaker_options)
        return self._breakers[channel]

    def publish(
        self,
        definition: MessageDefinition,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None,
        key: Optional[str] = None,
        schema_version: Optional[int] = None,
    ) -> Envelope:
        version = schema_version or definition.current_version
        if version == definition.current_version:
            problems = validate_payload(definition.schema, payload)
            if problems:
                raise ValidationError(definition.type, problems)
        ctx = current_context()
        env = create_envelope(
            type=definition.type,
            schema_version=version,
            correlation_id=correlation_id or (ctx.correlation_id if ctx else new_correlation_id()),
            causation_id=ctx.message_id if ctx else None,
            traceparent=format_traceparent(child_of(parse_traceparent(ctx.traceparent) if ctx else None)),
            source=self.service,
            payload=payload,
        )
        body = encode_envelope(env)
        headers = envelope_headers(env)

        def send() -> None:
            retry(
                lambda _a: self.transport.publish(definition.channel, body, headers, key),
                max_attempts=self._publish_attempts,
                base_ms=self._retry_base_ms,
                max_ms=self._retry_max_ms,
                sleep=self._sleep,
            )

        breaker = self.breaker_for(definition.channel)
        if breaker:
            breaker.execute(send)
        else:
            send()
        return env

    def subscribe(
        self,
        definition: MessageDefinition,
        group: str,
        handler: Callable[[Dict[str, Any], Envelope], None],
        start_from: str = "latest",
    ) -> Subscription:
        def dead_letter(message: TransportMessage, env: Optional[Envelope], reason: str, error: BaseException, attempts: int) -> None:
            dl = create_envelope(
                type="DeadLetter",
                schema_version=1,
                correlation_id=(env or {}).get("correlationId") or message.headers.get("x-correlation-id") or new_correlation_id(),
                causation_id=(env or {}).get("id"),
                traceparent=(env or {}).get("traceparent") or message.headers.get("traceparent") or format_traceparent(new_trace_context()),
                source=self.service,
                payload={"reason": reason, "error": str(error), "attempts": attempts, "originalChannel": definition.channel, "originalBody": message.body},
            )
            self.transport.publish(dead_letter_channel(definition.channel), encode_envelope(dl), envelope_headers(dl))

        def on_message(message: TransportMessage) -> None:
            env: Optional[Envelope] = None
            try:
                env = decode_envelope(message.body)
            except EnvelopeError as error:
                dead_letter(message, None, "invalid-envelope", error, message.delivery_count)
                return
            if env["type"] != definition.type:
                dead_letter(message, env, "type-mismatch", ValueError(f"expected {definition.type}, got {env['type']}"), message.delivery_count)
                return
            try:
                current = upcast_payload(definition, env["payload"], env["schemaVersion"], self._accept_newer)
            except SchemaVersionError as error:
                dead_letter(message, env, "schema-version", error, message.delivery_count)
                return
            except Exception as error:  # noqa: BLE001 - a broken upcaster must not wedge the consumer
                dead_letter(message, env, "invalid-payload", error, message.delivery_count)
                return
            problems = validate_payload(definition.schema, current)
            if problems:
                dead_letter(message, env, "invalid-payload", ValidationError(definition.type, problems), message.delivery_count)
                return
            span = format_traceparent(child_of(parse_traceparent(env["traceparent"])))
            delivered = dict(env)
            delivered["payload"] = current
            attempts = 0

            def attempt(n: int) -> None:
                nonlocal attempts
                attempts = n
                token = _current.set(MessageContext(env["correlationId"], span, env["id"]))  # type: ignore[index,unused-ignore]
                try:
                    handler(current, delivered)
                finally:
                    _current.reset(token)

            try:
                retry(attempt, max_attempts=self._handler_attempts, base_ms=self._retry_base_ms, max_ms=self._retry_max_ms, sleep=self._sleep)
            except RetryExhaustedError as error:
                dead_letter(message, env, "handler-failed", error.cause, attempts)

        sub = self.transport.subscribe(definition.channel, group, on_message, start_from)
        self._subs.append(sub)
        return sub

    def close(self) -> None:
        for sub in self._subs:
            sub.stop()
        self._subs.clear()
        self.transport.close()
