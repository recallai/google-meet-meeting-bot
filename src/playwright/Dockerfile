# 1. Base image with all Playwright dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# 2. Set working directory inside container
WORKDIR /app

# 3. Copy only package.json and lock file first (to take advantage of Docker layer caching)
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of the application code
COPY . .

# 6. Set environment variables (optional)
ENV NODE_ENV=production

# 7. Default command to run your bot script (adjust as needed)
CMD ["node", "runBot.js"]
