from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register() -> None:
    raise HTTPException(status_code=501, detail="auth ticket implements register")


@router.post("/login")
def login() -> None:
    raise HTTPException(status_code=501, detail="auth ticket implements login")


@router.post("/logout", status_code=204)
def logout() -> None:
    raise HTTPException(status_code=501, detail="auth ticket implements logout")
