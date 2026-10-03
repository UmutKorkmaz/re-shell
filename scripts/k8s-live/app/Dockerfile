# Packages a pre-built static binary (see scripts/k8s-live-check.sh); nothing
# else is needed at runtime, so the image is a bare `scratch` + non-root user.
FROM scratch
COPY app /app
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/app"]
