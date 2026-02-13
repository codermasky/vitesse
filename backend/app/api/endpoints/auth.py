from datetime import timedelta
from typing import Any
import msal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.services.user import user_service
from app.services.user import user_service
from app.services.settings_service import settings_service
from app.core.ratelimit import limiter

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/access-token"
)


@router.post("/access-token", response_model=schemas.Token)
@limiter.limit("5/minute")
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = await user_service.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/register", response_model=schemas.User)
@limiter.limit("5/minute")
async def register(
    *,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_in: schemas.UserCreate,
) -> Any:
    """
    Create new user.
    """
    user = await user_service.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this username already exists in the system.",
        )
    user = await user_service.create(db, obj_in=user_in)
    return user


@router.get("/me", response_model=schemas.User)
async def read_users_me(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> Any:
    """
    Get current user.
    """
    current_user = await user_service.get_current_user(db, token)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return current_user


@router.get("/azure-ad/login-url")
async def get_azure_ad_login_url() -> Any:
    """
    Get Azure AD login URL
    """
    config = settings_service.get_azure_ad_config()
    if not all(
        [
            config.get("AZURE_AD_CLIENT_ID"),
            config.get("AZURE_AD_TENANT_ID"),
            config.get("AZURE_AD_REDIRECT_URI"),
        ]
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure AD configuration is missing",
        )

    authority = f"https://login.microsoftonline.com/{config.get('AZURE_AD_TENANT_ID')}"
    app = msal.PublicClientApplication(
        client_id=config.get("AZURE_AD_CLIENT_ID"), authority=authority
    )

    scopes = (
        [f"{config.get('AZURE_AD_SCOPES')}"]
        if config.get("AZURE_AD_SCOPES")
        else ["User.Read"]
    )

    login_flow = app.initiate_auth_code_flow(
        scopes=scopes, redirect_uri=config.get("AZURE_AD_REDIRECT_URI")
    )

    return {"login_url": login_flow["auth_uri"], "state": login_flow["state"]}


@router.post("/azure-ad/callback", response_model=schemas.Token)
@limiter.limit("10/minute")
async def azure_ad_callback(
    request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Azure AD authentication callback
    """
    config = settings_service.get_azure_ad_config()
    if not all(
        [
            config.get("AZURE_AD_CLIENT_ID"),
            config.get("AZURE_AD_TENANT_ID"),
            config.get("AZURE_AD_REDIRECT_URI"),
        ]
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure AD configuration is missing",
        )

    authority = f"https://login.microsoftonline.com/{config.get('AZURE_AD_TENANT_ID')}"
    app = msal.PublicClientApplication(
        client_id=config.get("AZURE_AD_CLIENT_ID"), authority=authority
    )

    scopes = (
        [f"{config.get('AZURE_AD_SCOPES')}"]
        if config.get("AZURE_AD_SCOPES")
        else ["User.Read"]
    )

    try:
        result = app.acquire_token_by_auth_code_flow(
            {"state": state},
            code=code,
            scopes=scopes,
            redirect_uri=config.get("AZURE_AD_REDIRECT_URI"),
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Azure AD authentication failed: {result.get('error_description', result.get('error'))}",
            )

        # Get user info from Azure AD
        user_info = result.get("id_token_claims", {})
        email = user_info.get("preferred_username")
        full_name = user_info.get("name")
        sso_id = user_info.get("oid")  # Object ID from Azure AD

        if not email or not sso_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not retrieve user information from Azure AD",
            )

        # Check if user exists
        user = await user_service.get_by_sso_id(
            db, sso_provider="azure_ad", sso_id=sso_id
        )
        if not user:
            # Check if user exists by email
            user = await user_service.get_by_email(db, email=email)
            if user:
                # Update existing user with SSO info
                user.sso_provider = "azure_ad"
                user.sso_id = sso_id
                if not user.full_name and full_name:
                    user.full_name = full_name
                await db.commit()
                await db.refresh(user)
            else:
                # Create new user
                user_in = schemas.UserCreateSSO(
                    email=email,
                    full_name=full_name,
                    sso_provider="azure_ad",
                    sso_id=sso_id,
                )
                user = await user_service.create_sso(db, obj_in=user_in)

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            "token_type": "bearer",
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Authentication failed: {str(e)}",
        )
