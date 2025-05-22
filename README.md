# UptimeKuma as a Service

This project provides a backend service and Helm chart for deploying UptimeKuma instances in a Kubernetes cluster.

## Directory Structure

- `backend/`: Contains the TypeScript backend service and Dockerfile.
- `helm/`: Contains the Helm chart for deploying the backend and CRD.
- `.github/workflows/`: Contains the GitHub Actions workflow for CI/CD.

## How to Use This Project

### Prerequisites
- Docker
- Node.js (for local development)
- Helm (for chart packaging and deployment)
- Access to a Kubernetes cluster (for deployment)
- PostgreSQL database (for backend)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 2. Build and Run the Backend Locally
```bash
cd backend
npm install
npm run build
npm start
```
Set the `DATABASE_URL` environment variable if you are not using the default connection string.

### 3. Build and Run with Docker
```bash
docker build -t uptimekuma-backend ./backend
docker run -e DATABASE_URL=postgres://postgres:password@localhost:5432/uptimekuma_db -p 3000:3000 uptimekuma-backend
```

### 4. Linting
- **Backend:**
  ```bash
  cd backend
  npm run lint
  ```
- **Dockerfile:**
  Use [Hadolint](https://github.com/hadolint/hadolint):
  ```bash
  hadolint backend/Dockerfile
  ```
- **Helm Chart:**
  ```bash
  helm lint ./helm/utkaas
  ```

### 5. Build and Package the Helm Chart
```bash
helm package ./helm/utkaas --destination ./helm
```

### 6. Deploy to Kubernetes
```bash
helm install utkaas-backend ./helm/utkaas-0.1.0.tgz --namespace utkaas --create-namespace
```

### 7. CI/CD
- The project uses GitHub Actions to build, lint, and package the backend and Helm chart.
- Docker images are pushed to GitHub Container Registry (GHCR).
- Helm charts are uploaded as GitHub Actions artifacts and can be published to GitHub Pages for public access.

## Documentation & Wiki

- For comprehensive documentation, see the [GitHub Wiki](https://github.com/your-username/your-repo/wiki) for this project.
- The Wiki will be populated with:
  - Architecture overview
  - API documentation
  - Helm chart usage and customization
  - CI/CD and deployment guides
  - Troubleshooting and FAQ

If you have questions or want to contribute, please open an issue or pull request.