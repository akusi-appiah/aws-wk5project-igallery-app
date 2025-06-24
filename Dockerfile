# Stage 1: Build the frontend (Angular)
# FROM node:18 AS frontend-build
# WORKDIR /app/frontend
# COPY frontend/package*.json ./
# RUN npm install
# COPY frontend/ ./
# RUN npx ng build --configuration production  # Produces static files in dist/

# # Stage 2: Set up the backend (Node.js)
# FROM node:18
# WORKDIR /app/backend
# COPY backend/package*.json ./
# RUN npm install
# COPY backend/ ./

# # Copy the built frontend files into the backend's static directory
# COPY --from=frontend-build /app/frontend/dist/frontend/. /app/backend/public/

# # Expose the backend port (assuming 3000, adjust if different)
# EXPOSE 3000

# # Start the backend server
# CMD ["node", "server.js"]


FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html