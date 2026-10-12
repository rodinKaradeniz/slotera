FROM postgres:17-alpine
RUN apk add --no-cache rsync openssh-client
COPY backup.sh restore-drill.sh /usr/local/bin/
CMD ["sh", "-c", "while true; do /usr/local/bin/backup.sh || echo 'backup failed'; sleep 86400; done"]
