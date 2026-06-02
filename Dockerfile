# syntax=docker/dockerfile:1
# SMERP — Página Principal (Hub estático) servida pelo Nginx.
# Imagem leve: apenas copia os arquivos estáticos para o Nginx.

FROM nginx:alpine

# Remove a config padrão e aplica a nossa
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos do site
COPY index.html styles.css script.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# EasyPanel faz o proxy para a porta 3000 por padrão
EXPOSE 3000

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
