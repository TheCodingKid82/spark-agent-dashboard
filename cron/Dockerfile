FROM alpine:latest
RUN apk add --no-cache curl
CMD ["sh", "-c", "while true; do curl -s -X POST https://command-center-production-3605.up.railway.app/api/heartbeats/scheduler; sleep 60; done"]
