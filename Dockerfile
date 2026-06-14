FROM busybox:latest

WORKDIR /site

COPY index.html /site/index.html
COPY resources /site/resources

EXPOSE 8123

CMD ["httpd", "-f", "-p", "8123", "-h", "/site"]
