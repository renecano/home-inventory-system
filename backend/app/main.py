from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import products, movements, shopping, users, auth

app = FastAPI(title="Home Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(movements.router)
app.include_router(shopping.router)
app.include_router(users.router)
app.include_router(auth.router)