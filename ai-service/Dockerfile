# Assistente de IA do SMERP — imagem mínima pro EasyPanel.
# Node 22 (tem WebSocket nativo, exigido pela lib nova do Supabase).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
