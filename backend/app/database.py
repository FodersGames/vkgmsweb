from motor.motor_asyncio import AsyncIOMotorClient
from . import config

# tz_aware=True: without it, datetimes read back from Mongo are naive (no tzinfo), which crashes
# any comparison against a freshly-created datetime.now(timezone.utc) (e.g. mute/ban expiry checks).
client = AsyncIOMotorClient(config.MONGO_URL, tz_aware=True)
db = client[config.DB_NAME]
