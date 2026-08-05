from typing import List, Optional, Literal, Any
from pydantic import BaseModel, field_validator

from .deps import is_valid_permission

# ============== MODELS ==============
class LoginRequest(BaseModel):
    key: str

class LoginResponse(BaseModel):
    token: str
    user: dict
    first_login: bool = False
    new_key: Optional[str] = None

class CreateUserRequest(BaseModel):
    username: str
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

class CreateUserResponse(BaseModel):
    username: str
    access_key: str
    permissions: List[str]

class SendItemRequest(BaseModel):
    uid: str
    variable: str
    amount: str

class ServerStatusRequest(BaseModel):
    status: Literal["open", "maintenance", "closed"]

class ServerStatusResponse(BaseModel):
    status: str
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class UpdateUserPermissionsRequest(BaseModel):
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

VAR_TYPES = ("string", "number", "boolean", "list", "json")

class ServerVariableRequest(BaseModel):
    name: str
    var_type: Literal["string", "number", "boolean", "list", "json"] = "string"
    value: Any = None
    description: str = ""
    is_public: bool = True

class ServerVariableUpdateRequest(BaseModel):
    var_type: Optional[Literal["string", "number", "boolean", "list", "json"]] = None
    value: Any = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class CreateProjectRequest(BaseModel):
    name: str

class GameCreateRequest(BaseModel):
    name: str
    description: str
    logo_url: Optional[str] = ""
    screenshots: List[str] = []
    platforms: List[dict] = []  # [{name, url}]
    status: Literal["published", "draft", "coming_soon"] = "draft"
    featured: bool = False
    price_cents: int = 0
    product_type: Literal["game", "application", "software"] = "game"

class GameUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    screenshots: Optional[List[str]] = None
    platforms: Optional[List[dict]] = None
    status: Optional[Literal["published", "draft", "coming_soon"]] = None
    featured: Optional[bool] = None
    price_cents: Optional[int] = None
    product_type: Optional[Literal["game", "application", "software"]] = None

class BlogCreateRequest(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = ""
    published: bool = False

class BlogUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    published: Optional[bool] = None

class WebsiteSettingsRequest(BaseModel):
    maintenance_mode: Optional[bool] = None
    support_email: Optional[str] = None
    announcement_banner: Optional[str] = None
    announcement_active: Optional[bool] = None
    social_links: Optional[dict] = None
    seo_description: Optional[str] = None

class ChatMessageRequest(BaseModel):
    username: str
    message: str
    level: Optional[int] = None

# ── Chat & Guilds (Play — JWT-authenticated, channel-aware) ──────────────────
class PlayChatSendRequest(BaseModel):
    project_slug: str
    channel: Literal["global", "guild"]
    message: str

class ChatReactionRequest(BaseModel):
    emoji: str

class PlayGuildCreateRequest(BaseModel):
    project_slug: str
    name: str
    description: str = ""
    color: str = "#4ECDC4"
    logo_id: str = "shield"

class PlayGuildUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    logo_id: Optional[str] = None

class GuildMemberRoleRequest(BaseModel):
    role: Literal["officer", "member"]

class ChatBanRequest(BaseModel):
    user_id: str

class ChatMuteRequest(BaseModel):
    user_id: str
    duration_minutes: int
    reason: str = ""

class ChatMaintenanceRequest(BaseModel):
    chat_global_enabled: Optional[bool] = None
    chat_guilds_enabled: Optional[bool] = None

class BannedWordsUpdateRequest(BaseModel):
    words: List[str]

class ShopProductCreateRequest(BaseModel):
    name: str
    description: str = ""
    price: int
    image_url: str = ""
    badge: Optional[str] = None
    discount_pct: Optional[int] = None
    game_slug: str
    project_slug: str
    variable: str
    amount: str
    active: bool = True
    category: Optional[str] = None
    subcategory: Optional[str] = None
    featured: bool = False

class ShopProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    image_url: Optional[str] = None
    badge: Optional[str] = None
    discount_pct: Optional[int] = None
    game_slug: Optional[str] = None
    project_slug: Optional[str] = None
    variable: Optional[str] = None
    amount: Optional[str] = None
    active: Optional[bool] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    featured: Optional[bool] = None

class ShopCheckoutRequest(BaseModel):
    product_id: str
    player_uid: str
    coupon_code: Optional[str] = ""

class GamePurchaseCheckoutRequest(BaseModel):
    coupon_code: Optional[str] = ""

class GameFileUpdateRequest(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    platform: Optional[str] = None
    file_type: Optional[str] = None
    description: Optional[str] = None
    is_latest: Optional[bool] = None
    rotation_center_x: Optional[float] = None
    rotation_center_y: Optional[float] = None

class CouponCampaignRequest(BaseModel):
    name: str
    target_type: Literal["tier", "users"]
    target_tiers: List[str] = []
    target_user_ids: List[str] = []
    discount_pct: int
    valid_days: int
    scope: Literal["all", "product", "game"] = "all"
    scope_id: str = ""
    scope_name: str = ""

class CouponValidateRequest(BaseModel):
    code: str
    product_id: Optional[str] = None
    game_slug: Optional[str] = None

class MissionCreateRequest(BaseModel):
    title: str
    description: str = ""
    style_description: str = ""
    reference_images: List[str] = []
    priority: Literal["low", "medium", "high", "urgent"] = "medium"

class MissionUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    style_description: Optional[str] = None
    reference_images: Optional[List[str]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["open", "in_progress", "completed", "cancelled"]] = None

class MissionCompleteRequest(BaseModel):
    delivery_files: List[dict] = []  # [{url, filename, size}]

class MissionReopenRequest(BaseModel):
    feedback: str = ""
    keep_assigned: bool = True

class TicketCreateRequest(BaseModel):
    subject: str
    category: Literal["general", "technical", "billing", "account", "recruitment"] = "general"
    message: str
    career_id: Optional[str] = None

class TicketReplyRequest(BaseModel):
    content: str

class TicketStatusUpdateRequest(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved", "closed"]] = None
    priority: Optional[Literal["normal", "high", "urgent"]] = None

class AdminVakarPlusRequest(BaseModel):
    grant: bool

class StudioAppSubmitReviewRequest(BaseModel):
    name: str
    description: str
    tags: List[str] = []
    logo_url: str
    banner_url: str = ""
    price_cents: int = 0
    changelog: str = ""

class StudioAppReviewDecisionRequest(BaseModel):
    reason: str = ""

class RegisterRequest(BaseModel):
    email: str
    password: str
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""

class LoginEmailRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

class SuspendUserRequest(BaseModel):
    suspended: bool
    reason: Optional[str] = ""

class CliExecuteRequest(BaseModel):
    command: str
    confirm: bool = False

class UpdateProfileRequest(BaseModel):
    firstName: str
    lastName: Optional[str] = ""
    username: str

class SetPseudoRequest(BaseModel):
    username: str

class AdminUpdateUserProfileRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    username: Optional[str] = None

class ResetCooldownRequest(BaseModel):
    field: Literal["firstName", "username"]

class UpdateUserRoleRequest(BaseModel):
    role: Literal["user", "admin", "super_admin"]
    permissions: List[str] = []

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

class AdminCreateUserRequest(BaseModel):
    email: str
    password: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""
    role: Literal["user", "admin"] = "user"
    permissions: List[str] = []

class VersionCloneRequest(BaseModel):
    new_tag: str

class LiveVersionRequest(BaseModel):
    live_version: str

class NicknameRequest(BaseModel):
    project_slug: str
    nickname: str

class PlaySaveCategoryRequest(BaseModel):
    name: str
    label: Optional[str] = None
    player_scope: Literal["all", "specific"] = "all"
    target_user_ids: List[str] = []

class PlaySaveBulkUpdateRequest(BaseModel):
    user_ids: List[str]
    category: str
    data: str

class NutritionGoalsRequest(BaseModel):
    daily_calories: int = 2000
    daily_protein_g: int = 120
    daily_carbs_g: int = 250
    daily_fat_g: int = 65
    # Optional profile used to prefill the "estimate for me" calculator next time —
    # the four fields above remain the actual source of truth for tracking.
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Literal["male", "female"]] = None
    activity_level: Optional[Literal["sedentary", "light", "moderate", "active", "very_active"]] = None
    goal_type: Optional[Literal["lose", "maintain", "gain"]] = None

class NutritionGoalsEstimateRequest(BaseModel):
    weight_kg: float
    height_cm: float
    age: int
    sex: Literal["male", "female"]
    activity_level: Literal["sedentary", "light", "moderate", "active", "very_active"] = "moderate"
    goal_type: Literal["lose", "maintain", "gain"] = "maintain"

class FavoriteFoodCreateRequest(BaseModel):
    name: str
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    quantity_g: Optional[float] = None
    photo_url: Optional[str] = ""
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0

class MealEntryCreateRequest(BaseModel):
    name: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "snack"
    quantity_g: Optional[float] = None
    photo_url: Optional[str] = ""
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    logged_at: Optional[str] = None
    notes: Optional[str] = ""

class MealEntryUpdateRequest(BaseModel):
    name: Optional[str] = None
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    quantity_g: Optional[float] = None
    photo_url: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    logged_at: Optional[str] = None
    notes: Optional[str] = None

class StudioAppCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None

class StudioAppUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    accent_color: Optional[str] = None
    theme: Optional[str] = None
    screens: Optional[List[dict]] = None
    variables: Optional[List[dict]] = None
    package_id: Optional[str] = None
    min_sdk: Optional[int] = None
    target_sdk: Optional[int] = None
    app_display_name: Optional[str] = None
    app_icon_url: Optional[str] = None

class StudioAppStatusRequest(BaseModel):
    status: Literal["draft", "published"]

class StudioAppVisibilityRequest(BaseModel):
    visibility: Literal["public", "private"]

class VakarPlusCheckoutRequest(BaseModel):
    plan: Literal["monthly", "yearly"]

class ApkBuildTriggerRequest(BaseModel):
    bundle_url: str

class CareerCreateRequest(BaseModel):
    title: str
    department: str
    contract_type: str
    location: str
    description: str
    requirements: List[str] = []
    tools: List[str] = []
    is_open: bool = True

class CareerUpdateRequest(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    contract_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    is_open: Optional[bool] = None
