FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Expose port
EXPOSE 3030

# Start server
CMD ["npm", "start"]
