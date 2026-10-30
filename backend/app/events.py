"""In-process Server-Sent Events broker. Every connected browser receives change notifications."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self.version = 0

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, event: str, data: dict[str, Any] | None = None) -> None:
        """Thread-safe publish. Request handlers run in a thread pool, so hop onto the loop."""
        self.version += 1
        payload = {"event": event, "version": self.version, "at": time.time(), **(data or {})}
        message = json.dumps(payload)

        def _fanout() -> None:
            for q in list(self._subscribers):
                try:
                    q.put_nowait(message)
                except asyncio.QueueFull:
                    pass  # slow client: it will resync on the next event or poll

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(_fanout)


broker = EventBroker()
