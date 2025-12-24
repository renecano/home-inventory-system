# Home Inventory System 🏠📦

A **full-stack home inventory management system** to track products, consumption, and restocks, with minimum stock alerts and smart usage-based predictions.

---

## 🚀 Main Features

- 📦 Product management with minimum stock levels
- 🔄 Tracking of **consumption** and **restocks**
- ⚠️ Alerts when stock is running low
- 🔮 **Smart prediction of remaining days** based on the last 14 days of usage
- 👤 Basic user handling
- 📱 Responsive UI designed for daily use

---

## 🧱 Project Architecture

This project follows a **monorepo approach**, clearly separating frontend and backend:

```
home-inventory-system/
├── backend/        # REST API (FastAPI)
│   ├── app/
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/       # Web App (Next.js)
│   ├── app/
│   ├── package.json
│   └── next.config.js
│
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- React hooks (`useEffect`, `useMemo`)

### Backend
- **FastAPI**
- **SQLAlchemy**
- **Alembic** (database migrations)
- REST API

### Infrastructure
- **Docker**
- **Docker Compose**
- Environment variables (`.env`)

---

## 🔮 Smart Prediction Logic

The system estimates how many days of stock remain for each product by:

- Analyzing **consumption from the last 14 days**
- Calculating the average daily usage
- Prioritizing products that:
  - Are below minimum stock
  - Have fewer estimated days remaining

This helps anticipate shortages before they happen.

---

## ▶️ How to Run the Project (Docker)

### Requirements
- Docker
- Docker Compose

### Run the full stack
```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

---

## 📄 Environment Variables

Example files are included in the repository.

### Backend (`backend/.env.example`)
```env
DATABASE_URL=postgresql://user:password@db:5432/inventory
SECRET_KEY=changeme
```

### Frontend (`frontend/.env.example`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---


## 🧠 UX & Design Decisions

- Mobile-first navigation with bottom tab bar
- Clear separation between inventory, shopping list, and history
- Minimal authentication flow designed for shared family use
- Optimistic UI updates for faster interaction

  
---

## 📸 Screenshots

<img width="1242" height="1246" alt="image" src="https://github.com/user-attachments/assets/4f82bbf6-28dd-4627-9877-ab52e3bf9767" />
<img width="1079" height="1057" alt="image" src="https://github.com/user-attachments/assets/a0d0f6e9-aed8-4f59-8c5b-6c62670e4699" />
<img width="983" height="802" alt="image" src="https://github.com/user-attachments/assets/16ea057f-bd4d-47b8-94a5-17e580ecac33" />
<img width="925" height="1238" alt="image" src="https://github.com/user-attachments/assets/bf641aa3-4bbd-4804-9448-d395943f330d" />



---

## 🎯 Project Purpose

This project was developed as:
- A **full-stack development practice**
- A demonstration of **clean architecture**
- A **professional portfolio project**

---

## 👨‍💻 Author

**René Cano**  
Computer Engineering (ITC)  
Tecnológico de Monterrey  

GitHub: https://github.com/renecano
