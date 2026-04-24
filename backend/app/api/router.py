from fastapi import APIRouter

from app.api.routes.analyses import router as analyses_router
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.upload import router as upload_router
from app.api.routes.users import router as users_router
from app.api.routes.webhooks import router as webhooks_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(jobs_router)
api_router.include_router(analyses_router)
api_router.include_router(users_router)
api_router.include_router(webhooks_router)
