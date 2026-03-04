FROM nginx:alpine

# Crear directorio y copiar TODOS los archivos del frontend
COPY frontend/ /usr/share/nginx/html/

# Configuración de nginx
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Verificar que los archivos se copiaron correctamente
RUN ls -la /usr/share/nginx/html/

# Asegurar permisos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]