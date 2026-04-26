# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Inject environment variables as build args (passed by Coolify)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_EDGE_URL
ARG VITE_GOTIFY_URL
ARG VITE_GOTIFY_TOKEN
ARG VITE_GOWA_URL
ARG VITE_GOWA_USER
ARG VITE_GOWA_PASS

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_EDGE_URL=$VITE_EDGE_URL
ENV VITE_GOTIFY_URL=$VITE_GOTIFY_URL
ENV VITE_GOTIFY_TOKEN=$VITE_GOTIFY_TOKEN
ENV VITE_GOWA_URL=$VITE_GOWA_URL
ENV VITE_GOWA_USER=$VITE_GOWA_USER
ENV VITE_GOWA_PASS=$VITE_GOWA_PASS

RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA (React Router / client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
