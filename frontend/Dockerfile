# Use Nginx Alpine for minimal image size
FROM nginx:alpine

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files to Nginx html directory
COPY ./public /usr/share/nginx/html

# Fix file permissions for nginx user
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Expose port 80
EXPOSE 80

# Start Nginx (runs in foreground)
CMD ["nginx", "-g", "daemon off;"]
