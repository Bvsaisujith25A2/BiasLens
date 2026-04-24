from typing import Any

import httpx

from app.core.config import Settings


class ColabService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def trigger_analysis(self, payload: dict[str, Any]) -> bool:
        if not self.settings.colab_trigger_url:
            return False

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.settings.colab_shared_secret:
            headers["X-Worker-Secret"] = self.settings.colab_shared_secret

        async with httpx.AsyncClient(timeout=self.settings.colab_request_timeout_seconds) as client:
            response = await client.post(
                self.settings.colab_trigger_url,
                json=payload,
                headers=headers,
            )
            return response.status_code in (200, 201, 202)
