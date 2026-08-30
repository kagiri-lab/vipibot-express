FROM node:20-bookworm

# Set working directory
WORKDIR /app

# Install dependencies required by node-gyp, canvas, and hnswlib-node
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies explicitly allowing scripts for C++ rebuilds
RUN npm install --legacy-peer-deps --ignore-scripts=false

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the application port
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]
