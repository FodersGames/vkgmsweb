from typing import List, Optional, Literal
from pydantic import BaseModel, field_validator

from .deps import is_valid_permission

# ============== AUTH & PROFILE MODELS ==============
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""

class LoginEmailRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: str

class SetPseudoRequest(BaseModel):
    username: str


# ============== USER MANAGEMENT MODELS ==============
class AdminCreateUserRequest(BaseModel):
    email: str
    password: Optional[str] = ""
    name: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""
    role: Literal["user", "admin"] = "user"
    permissions: List[str] = []
    custom_roles: List[str] = []

class AdminUpdateUserProfileRequest(BaseModel):
    name: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    username: Optional[str] = None

class SuspendUserRequest(BaseModel):
    suspended: bool
    reason: Optional[str] = ""

class ResetCooldownRequest(BaseModel):
    field: Literal["name", "firstName", "username"]

class UpdateUserPermissionsRequest(BaseModel):
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

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

class UpdateUserCustomRolesRequest(BaseModel):
    custom_roles: List[str] = []


# ============== ROLE MANAGEMENT MODELS ==============
class RoleCreateRequest(BaseModel):
    name: str
    color: str = "#4ECDC4"
    icon: str = "Shield"
    permissions: List[str] = []
    description: Optional[str] = ""

class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    permissions: Optional[List[str]] = None
    description: Optional[str] = None


# ============== WEBSITE & CONTENT MODELS ==============
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
    allowed_roles: Optional[List[str]] = []

class BlogUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    published: Optional[bool] = None
    allowed_roles: Optional[List[str]] = None

class WebsiteSettingsRequest(BaseModel):
    maintenance_mode: Optional[bool] = None
    maintenance_scheduled_at: Optional[str] = None
    maintenance_announcement: Optional[str] = None
    support_email: Optional[str] = None
    announcement_banner: Optional[str] = None
    announcement_active: Optional[bool] = None
    social_links: Optional[dict] = None
    seo_description: Optional[str] = None


# ============== SUPPORT TICKETS ==============
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


# ============== CAREERS ==============
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


# ============== SURVEYS ==============
class SurveyQuestionSchema(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    type: Literal["choice", "multiple_choice", "rating", "text", "long_text"] = "choice"
    options: List[str] = []
    required: bool = False

class SurveyCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    slug: Optional[str] = None
    status: Literal["active", "closed"] = "active"
    allow_anonymous: bool = True
    questions: List[SurveyQuestionSchema] = []

class SurveyUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[Literal["active", "closed"]] = None
    allow_anonymous: Optional[bool] = None
    questions: Optional[List[SurveyQuestionSchema]] = None

class SurveySubmitRequest(BaseModel):
    answers: dict = {}
    username: Optional[str] = None


# ============== SYSTEM & CLI ==============
class CliExecuteRequest(BaseModel):
    command: str
    confirm: bool = False
