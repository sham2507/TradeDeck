FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the TypeScript code
RUN npm run build

# Set environment variable
ENV DATABASE_URL="file:./data/dev.db"

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

